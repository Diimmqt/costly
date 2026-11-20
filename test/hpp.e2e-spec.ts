import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  AdditionalCostCategory,
  MaterialCategory,
  MaterialUnit,
  ProductCategory,
  ProductStatus,
  StockStatus,
} from '../generated/prisma/enums.js';
import type {
  HppAdditionalCostModel,
  HppCalculationModel,
  HppMaterialSnapshotModel,
  MaterialModel,
  ProductModel,
  RecipeItemModel,
  RecipeModel,
} from '../generated/prisma/models.js';
import { AppModule } from '../src/app.module.js';
import { HPP_ROUNDING_RULE } from '../src/hpp/entities/hpp.entity.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('HPP API (e2e)', () => {
  let app: INestApplication<App>;

  const productsStore = new Map<string, ProductModel>();
  const materialsStore = new Map<string, MaterialModel>();
  const recipesStore = new Map<string, RecipeModel>();
  const recipeItemsStore = new Map<string, RecipeItemModel>();
  const hppStore = new Map<string, HppCalculationModel>();
  const snapshotsStore = new Map<string, HppMaterialSnapshotModel>();
  const costsStore = new Map<string, HppAdditionalCostModel>();

  let failNextHppCreate = false;

  const hydrateHpp = (record: HppCalculationModel) => ({
    ...record,
    materialSnapshots: Array.from(snapshotsStore.values())
      .filter((s) => s.hppCalculationId === record.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    additionalCosts: Array.from(costsStore.values())
      .filter((c) => c.hppCalculationId === record.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  });

  const mockPrisma = {
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
    $transaction: vi.fn(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
        // Snapshot in-memory maps so we can verify atomic rollback on error
        const prevHpp = new Map(hppStore);
        const prevSnap = new Map(snapshotsStore);
        const prevCost = new Map(costsStore);
        try {
          return await callback(mockPrisma);
        } catch (error) {
          hppStore.clear();
          prevHpp.forEach((v, k) => hppStore.set(k, v));
          snapshotsStore.clear();
          prevSnap.forEach((v, k) => snapshotsStore.set(k, v));
          costsStore.clear();
          prevCost.forEach((v, k) => costsStore.set(k, v));
          throw error;
        }
      },
    ),
    product: {
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { id: string };
          include?: { recipe?: unknown };
        }) => {
          const product = productsStore.get(where.id);
          if (!product) return null;
          if (include?.recipe) {
            const recipe =
              Array.from(recipesStore.values()).find(
                (r) => r.productId === product.id,
              ) ?? null;
            if (!recipe) {
              return { ...product, recipe: null };
            }
            const items = Array.from(recipeItemsStore.values())
              .filter((i) => i.recipeId === recipe.id)
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
              .map((i) => ({
                ...i,
                material: materialsStore.get(i.materialId) ?? null,
              }));
            return { ...product, recipe: { ...recipe, items } };
          }
          return product;
        },
      ),
    },
    hppCalculation: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            productId: string;
            recipeId: string;
            productCode: string;
            productName: string;
            productCategory: ProductCategory;
            productSellingPrice: Prisma.Decimal | null;
            recipeName: string | null;
            recipeYieldQuantity: Prisma.Decimal;
            recipeYieldUnit: string;
            productionQuantity: Prisma.Decimal;
            totalMaterialCost: Prisma.Decimal;
            totalAdditionalCost: Prisma.Decimal;
            totalHpp: Prisma.Decimal;
            hppPerUnit: Prisma.Decimal;
            roundingRule: string;
            notes: string | null;
            calculatedAt: Date;
            materialSnapshots?: {
              create: Array<
                Omit<
                  HppMaterialSnapshotModel,
                  'id' | 'hppCalculationId' | 'createdAt'
                >
              >;
            };
            additionalCosts?: {
              create: Array<
                Omit<
                  HppAdditionalCostModel,
                  'id' | 'hppCalculationId' | 'createdAt'
                >
              >;
            };
          };
        }) => {
          const now = new Date();
          const record: HppCalculationModel = {
            id: crypto.randomUUID(),
            productId: data.productId,
            recipeId: data.recipeId,
            productCode: data.productCode,
            productName: data.productName,
            productCategory: data.productCategory,
            productSellingPrice: data.productSellingPrice,
            recipeName: data.recipeName,
            recipeYieldQuantity: data.recipeYieldQuantity,
            recipeYieldUnit: data.recipeYieldUnit,
            productionQuantity: data.productionQuantity,
            totalMaterialCost: data.totalMaterialCost,
            totalAdditionalCost: data.totalAdditionalCost,
            totalHpp: data.totalHpp,
            hppPerUnit: data.hppPerUnit,
            roundingRule: data.roundingRule,
            notes: data.notes,
            calculatedAt: data.calculatedAt,
            createdAt: now,
          };
          hppStore.set(record.id, record);

          if (failNextHppCreate) {
            failNextHppCreate = false;
            throw new Error('Simulated mid-transaction failure');
          }

          let idx = 0;
          for (const snap of data.materialSnapshots?.create ?? []) {
            const snapRecord: HppMaterialSnapshotModel = {
              id: crypto.randomUUID(),
              hppCalculationId: record.id,
              materialId: snap.materialId ?? null,
              materialCode: snap.materialCode,
              materialName: snap.materialName,
              materialCategory: snap.materialCategory,
              usageQuantity: snap.usageQuantity,
              usageUnit: snap.usageUnit,
              baseQuantity: snap.baseQuantity,
              baseUnit: snap.baseUnit,
              unitPrice: snap.unitPrice,
              subtotalCost: snap.subtotalCost,
              notes: snap.notes ?? null,
              createdAt: new Date(now.getTime() + idx++),
            };
            snapshotsStore.set(snapRecord.id, snapRecord);
          }

          for (const cost of data.additionalCosts?.create ?? []) {
            const costRecord: HppAdditionalCostModel = {
              id: crypto.randomUUID(),
              hppCalculationId: record.id,
              category: cost.category,
              name: cost.name,
              amount: cost.amount,
              notes: cost.notes ?? null,
              createdAt: new Date(now.getTime() + idx++),
            };
            costsStore.set(costRecord.id, costRecord);
          }

          return hydrateHpp(record);
        },
      ),
      findMany: vi.fn(
        async ({
          where = {},
          skip = 0,
          take = 10,
          orderBy = { calculatedAt: 'desc' },
        }: {
          where?: {
            productId?: string;
            OR?: Array<{
              productName?: { contains: string };
              productCode?: { contains: string };
            }>;
            calculatedAt?: { gte?: Date; lte?: Date };
          };
          skip?: number;
          take?: number;
          orderBy?: Record<string, 'asc' | 'desc'>;
        }) => {
          let list = Array.from(hppStore.values());
          if (where.productId) {
            list = list.filter((r) => r.productId === where.productId);
          }
          if (where.OR) {
            const term = (
              where.OR[0]?.productName?.contains ?? ''
            ).toLowerCase();
            list = list.filter(
              (r) =>
                r.productName.toLowerCase().includes(term) ||
                r.productCode.toLowerCase().includes(term),
            );
          }
          if (where.calculatedAt?.gte) {
            const gte = where.calculatedAt.gte.getTime();
            list = list.filter((r) => r.calculatedAt.getTime() >= gte);
          }
          if (where.calculatedAt?.lte) {
            const lte = where.calculatedAt.lte.getTime();
            list = list.filter((r) => r.calculatedAt.getTime() <= lte);
          }

          const [sortField, sortDir] = Object.entries(orderBy)[0] ?? [
            'calculatedAt',
            'desc',
          ];
          list.sort((a, b) => {
            const av = (a as unknown as Record<string, unknown>)[sortField];
            const bv = (b as unknown as Record<string, unknown>)[sortField];
            const an = av instanceof Date ? av.getTime() : Number(av);
            const bn = bv instanceof Date ? bv.getTime() : Number(bv);
            if (!Number.isNaN(an) && !Number.isNaN(bn)) {
              return sortDir === 'asc' ? an - bn : bn - an;
            }
            return sortDir === 'asc'
              ? String(av).localeCompare(String(bv))
              : String(bv).localeCompare(String(av));
          });

          return list.slice(skip, skip + take).map(hydrateHpp);
        },
      ),
      count: vi.fn(
        async ({
          where = {},
        }: {
          where?: {
            productId?: string;
            OR?: Array<{
              productName?: { contains: string };
              productCode?: { contains: string };
            }>;
            calculatedAt?: { gte?: Date; lte?: Date };
          };
        }) => {
          let list = Array.from(hppStore.values());
          if (where.productId) {
            list = list.filter((r) => r.productId === where.productId);
          }
          if (where.OR) {
            const term = (
              where.OR[0]?.productName?.contains ?? ''
            ).toLowerCase();
            list = list.filter(
              (r) =>
                r.productName.toLowerCase().includes(term) ||
                r.productCode.toLowerCase().includes(term),
            );
          }
          if (where.calculatedAt?.gte) {
            const gte = where.calculatedAt.gte.getTime();
            list = list.filter((r) => r.calculatedAt.getTime() >= gte);
          }
          if (where.calculatedAt?.lte) {
            const lte = where.calculatedAt.lte.getTime();
            list = list.filter((r) => r.calculatedAt.getTime() <= lte);
          }
          return list.length;
        },
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = hppStore.get(where.id);
        return record ? hydrateHpp(record) : null;
      }),
      findFirst: vi.fn(
        async ({ where }: { where: { productId: string } }) => {
          const list = Array.from(hppStore.values())
            .filter((r) => r.productId === where.productId)
            .sort(
              (a, b) =>
                b.calculatedAt.getTime() - a.calculatedAt.getTime() ||
                b.createdAt.getTime() - a.createdAt.getTime(),
            );
          return list[0] ? hydrateHpp(list[0]) : null;
        },
      ),
    },
  };

  let esKopiId: string;
  let noRecipeProductId: string;
  let emptyRecipeProductId: string;
  let kopiMaterialId: string;
  let susuMaterialId: string;
  let gulaMaterialId: string;
  let esKopiRecipeId: string;
  let kopiRecipeItemId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: '', method: RequestMethod.GET }],
    });
    await app.init();
  });

  beforeEach(() => {
    productsStore.clear();
    materialsStore.clear();
    recipesStore.clear();
    recipeItemsStore.clear();
    hppStore.clear();
    snapshotsStore.clear();
    costsStore.clear();
    failNextHppCreate = false;

    const now = new Date('2026-11-20T08:00:00.000Z');

    esKopiId = crypto.randomUUID();
    noRecipeProductId = crypto.randomUUID();
    emptyRecipeProductId = crypto.randomUUID();
    kopiMaterialId = crypto.randomUUID();
    susuMaterialId = crypto.randomUUID();
    gulaMaterialId = crypto.randomUUID();
    esKopiRecipeId = crypto.randomUUID();
    kopiRecipeItemId = crypto.randomUUID();

    productsStore.set(esKopiId, {
      id: esKopiId,
      code: 'PRD-001',
      name: 'Es Kopi Susu',
      category: ProductCategory.BEVERAGE,
      description: 'Signature coffee',
      sellingPrice: new Prisma.Decimal(18000),
      status: ProductStatus.ACTIVE,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    productsStore.set(noRecipeProductId, {
      id: noRecipeProductId,
      code: 'PRD-002',
      name: 'Air Mineral',
      category: ProductCategory.BEVERAGE,
      description: null,
      sellingPrice: new Prisma.Decimal(5000),
      status: ProductStatus.ACTIVE,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    productsStore.set(emptyRecipeProductId, {
      id: emptyRecipeProductId,
      code: 'PRD-003',
      name: 'Produk Resep Kosong',
      category: ProductCategory.SNACK,
      description: null,
      sellingPrice: null,
      status: ProductStatus.ACTIVE,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Materials with unit conversions (KG -> G, L -> ML, G -> G)
    materialsStore.set(kopiMaterialId, {
      id: kopiMaterialId,
      code: 'BB-KOPI',
      name: 'Kopi',
      category: MaterialCategory.MAIN,
      unit: MaterialUnit.KILOGRAM,
      purchasePrice: new Prisma.Decimal(100000), // Rp100.000/kg = Rp100/g
      stock: new Prisma.Decimal(5),
      minStock: new Prisma.Decimal(1),
      stockStatus: StockStatus.AVAILABLE,
      isLowStock: false,
      description: null,
      createdAt: now,
      updatedAt: now,
    });

    materialsStore.set(susuMaterialId, {
      id: susuMaterialId,
      code: 'BB-SUSU',
      name: 'Susu',
      category: MaterialCategory.MAIN,
      unit: MaterialUnit.LITER,
      purchasePrice: new Prisma.Decimal(20000), // Rp20.000/L = Rp20/ml
      stock: new Prisma.Decimal(10),
      minStock: new Prisma.Decimal(2),
      stockStatus: StockStatus.AVAILABLE,
      isLowStock: false,
      description: null,
      createdAt: now,
      updatedAt: now,
    });

    materialsStore.set(gulaMaterialId, {
      id: gulaMaterialId,
      code: 'BB-GULA',
      name: 'Gula',
      category: MaterialCategory.SUPPORTING,
      unit: MaterialUnit.GRAM,
      purchasePrice: new Prisma.Decimal(15), // Rp15/g
      stock: new Prisma.Decimal(2000),
      minStock: new Prisma.Decimal(200),
      stockStatus: StockStatus.AVAILABLE,
      isLowStock: false,
      description: null,
      createdAt: now,
      updatedAt: now,
    });

    recipesStore.set(esKopiRecipeId, {
      id: esKopiRecipeId,
      productId: esKopiId,
      name: 'Resep Es Kopi Susu',
      notes: null,
      yieldQuantity: new Prisma.Decimal(2),
      yieldUnit: 'cup',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const emptyRecipeId = crypto.randomUUID();
    recipesStore.set(emptyRecipeId, {
      id: emptyRecipeId,
      productId: emptyRecipeProductId,
      name: 'Resep Kosong',
      notes: null,
      yieldQuantity: new Prisma.Decimal(1),
      yieldUnit: 'portion',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    recipeItemsStore.set(kopiRecipeItemId, {
      id: kopiRecipeItemId,
      recipeId: esKopiRecipeId,
      materialId: kopiMaterialId,
      quantity: new Prisma.Decimal(15),
      unit: MaterialUnit.GRAM,
      baseQuantity: new Prisma.Decimal(0.015),
      baseUnit: MaterialUnit.KILOGRAM,
      notes: 'Espresso shot',
      createdAt: new Date(now.getTime() + 1),
      updatedAt: now,
    });

    const susuItemId = crypto.randomUUID();
    recipeItemsStore.set(susuItemId, {
      id: susuItemId,
      recipeId: esKopiRecipeId,
      materialId: susuMaterialId,
      quantity: new Prisma.Decimal(150),
      unit: MaterialUnit.MILLILITER,
      baseQuantity: new Prisma.Decimal(0.15),
      baseUnit: MaterialUnit.LITER,
      notes: null,
      createdAt: new Date(now.getTime() + 2),
      updatedAt: now,
    });

    const gulaItemId = crypto.randomUUID();
    recipeItemsStore.set(gulaItemId, {
      id: gulaItemId,
      recipeId: esKopiRecipeId,
      materialId: gulaMaterialId,
      quantity: new Prisma.Decimal(20),
      unit: MaterialUnit.GRAM,
      baseQuantity: new Prisma.Decimal(20),
      baseUnit: MaterialUnit.GRAM,
      notes: null,
      createdAt: new Date(now.getTime() + 3),
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/hpp/calculate should compute preview without saving and without deducting stock', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hpp/calculate')
      .send({
        productId: esKopiId,
        productionQuantity: 2,
        additionalCosts: [
          {
            category: AdditionalCostCategory.LABOR,
            name: 'Tenaga Kerja',
            amount: 1000,
          },
          {
            category: AdditionalCostCategory.ELECTRICITY,
            name: 'Listrik',
            amount: 200,
          },
        ],
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isSaved).toBe(false);
    expect(res.body.data.totalMaterialCost).toBe(4800);
    expect(res.body.data.totalAdditionalCost).toBe(1200);
    expect(res.body.data.totalHpp).toBe(6000);
    expect(res.body.data.hppPerUnit).toBe(3000);
    expect(res.body.data.roundingRule).toBe(HPP_ROUNDING_RULE);
    expect(hppStore.size).toBe(0);
    // Stock must remain completely untouched
    expect(Number(materialsStore.get(kopiMaterialId)!.stock)).toBe(5);
  });

  it('POST /api/v1/hpp should save immutable historical snapshot unaffected by future master price or recipe changes', async () => {
    const saveRes = await request(app.getHttpServer())
      .post('/api/v1/hpp')
      .send({
        productId: esKopiId,
        productionQuantity: 2,
        additionalCosts: [
          {
            category: AdditionalCostCategory.GAS,
            name: 'Gas & Listrik',
            amount: 1200,
            notes: 'Estimasi per batch',
          },
        ],
        notes: 'Perhitungan awal',
      })
      .expect(201);

    const savedId = saveRes.body.data.id as string;
    expect(saveRes.body.data.isSaved).toBe(true);
    expect(saveRes.body.data.totalMaterialCost).toBe(4800);
    expect(saveRes.body.data.totalAdditionalCost).toBe(1200);
    expect(saveRes.body.data.totalHpp).toBe(6000);
    expect(saveRes.body.data.hppPerUnit).toBe(3000);

    // Mutate master material price AND recipe usage quantity after saving
    const kopi = materialsStore.get(kopiMaterialId)!;
    kopi.purchasePrice = new Prisma.Decimal(200000); // doubled from Rp100k/kg to Rp200k/kg
    const kopiItem = recipeItemsStore.get(kopiRecipeItemId)!;
    kopiItem.quantity = new Prisma.Decimal(30); // doubled from 15g to 30g

    // Historical calculation must remain 100% unchanged!
    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/hpp/${savedId}`)
      .expect(200);

    expect(detailRes.body.data.totalMaterialCost).toBe(4800);
    expect(detailRes.body.data.totalHpp).toBe(6000);
    expect(detailRes.body.data.hppPerUnit).toBe(3000);
    const savedKopiSnap = detailRes.body.data.materialSnapshots.find(
      (s: { materialCode: string }) => s.materialCode === 'BB-KOPI',
    );
    expect(savedKopiSnap.usageQuantity).toBe(15);
    expect(savedKopiSnap.unitPrice).toBe(100000);
    expect(savedKopiSnap.subtotalCost).toBe(1500);

    // A NEW calculation must reflect the updated price & recipe
    // Kopi: 0.03 kg * 200,000 = 6,000; Susu: 3,000; Gula: 300 -> Total material = 9,300; / 2 = 4,650
    const nextRes = await request(app.getHttpServer())
      .post('/api/v1/hpp')
      .send({
        productId: esKopiId,
        productionQuantity: 2,
      })
      .expect(201);

    expect(nextRes.body.data.totalMaterialCost).toBe(9300);
    expect(nextRes.body.data.hppPerUnit).toBe(4650);

    // Latest HPP endpoint should return the newly saved record
    const latestRes = await request(app.getHttpServer())
      .get(`/api/v1/products/${esKopiId}/hpp/latest`)
      .expect(200);

    expect(latestRes.body.data.id).toBe(nextRes.body.data.id);
    expect(latestRes.body.data.hppPerUnit).toBe(4650);
  });

  it('GET /api/v1/hpp should support productId filter, search, date range, pagination, and sorting', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/hpp')
      .send({ productId: esKopiId, productionQuantity: 2 })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/api/v1/hpp')
      .send({
        productId: esKopiId,
        productionQuantity: 2,
        additionalCosts: [{ name: 'Listrik', amount: 1200 }],
      })
      .expect(201);

    // Adjust calculatedAt dates for deterministic date range testing
    hppStore.get(first.body.data.id)!.calculatedAt = new Date(
      '2026-11-10T10:00:00.000Z',
    );
    hppStore.get(second.body.data.id)!.calculatedAt = new Date(
      '2026-11-20T10:00:00.000Z',
    );

    const filteredRes = await request(app.getHttpServer())
      .get('/api/v1/hpp')
      .query({
        productId: esKopiId,
        search: 'Kopi',
        dateFrom: '2026-11-15',
        dateTo: '2026-11-25',
        page: 1,
        limit: 5,
        sortBy: 'totalHpp',
        sortOrder: 'desc',
      })
      .expect(200);

    expect(filteredRes.body.data).toHaveLength(1);
    expect(filteredRes.body.data[0].id).toBe(second.body.data.id);
    expect(filteredRes.body.meta.total).toBe(1);
  });

  it('should reject invalid inputs, missing recipe, empty recipe, and incompatible units', async () => {
    // Product without recipe -> 400
    await request(app.getHttpServer())
      .post('/api/v1/hpp/calculate')
      .send({ productId: noRecipeProductId, productionQuantity: 1 })
      .expect(400);

    // Product with empty recipe -> 400
    await request(app.getHttpServer())
      .post('/api/v1/hpp/calculate')
      .send({ productId: emptyRecipeProductId, productionQuantity: 1 })
      .expect(400);

    // Negative additional cost -> 400 (ValidationPipe)
    await request(app.getHttpServer())
      .post('/api/v1/hpp/calculate')
      .send({
        productId: esKopiId,
        productionQuantity: 1,
        additionalCosts: [{ name: 'Listrik', amount: -500 }],
      })
      .expect(400);

    // Non-positive productionQuantity -> 400 (ValidationPipe)
    await request(app.getHttpServer())
      .post('/api/v1/hpp/calculate')
      .send({ productId: esKopiId, productionQuantity: 0 })
      .expect(400);

    // Incompatible unit (material changed to LITER while recipe uses GRAM) -> 400
    materialsStore.get(kopiMaterialId)!.unit = MaterialUnit.LITER;
    await request(app.getHttpServer())
      .post('/api/v1/hpp/calculate')
      .send({ productId: esKopiId, productionQuantity: 1 })
      .expect(400);
  });

  it('should roll back atomically if database transaction fails while saving HPP', async () => {
    failNextHppCreate = true;

    await request(app.getHttpServer())
      .post('/api/v1/hpp')
      .send({ productId: esKopiId, productionQuantity: 2 })
      .expect(500);

    expect(hppStore.size).toBe(0);
    expect(snapshotsStore.size).toBe(0);
    expect(costsStore.size).toBe(0);
  });
});

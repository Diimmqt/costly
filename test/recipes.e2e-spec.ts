import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  MaterialCategory,
  MaterialUnit,
  ProductCategory,
  ProductStatus,
  StockStatus,
} from '../generated/prisma/enums.js';
import type {
  MaterialModel,
  ProductModel,
  RecipeItemModel,
  RecipeModel,
} from '../generated/prisma/models.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Recipes API (e2e)', () => {
  let app: INestApplication<App>;

  const productsStore = new Map<string, ProductModel>();
  const materialsStore = new Map<string, MaterialModel>();
  const recipesStore = new Map<string, RecipeModel>();
  const itemsStore = new Map<string, RecipeItemModel>();

  const buildRecipeWithRelations = (recipe: RecipeModel) => {
    const product = productsStore.get(recipe.productId)!;
    const items = Array.from(itemsStore.values())
      .filter((item) => item.recipeId === recipe.id)
      .map((item) => ({
        ...item,
        material: materialsStore.get(item.materialId)!,
      }));
    return { ...recipe, product, items };
  };

  const mockPrisma = {
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
    $transaction: vi.fn(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma),
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
            return { ...product, recipe: recipe ? { id: recipe.id } : null };
          }
          return product;
        },
      ),
    },
    material: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return materialsStore.get(where.id) ?? null;
      }),
      findMany: vi.fn(
        async ({ where }: { where: { id: { in: string[] } } }) => {
          return where.id.in
            .map((id) => materialsStore.get(id))
            .filter((m): m is MaterialModel => Boolean(m));
        },
      ),
    },
    recipe: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            productId: string;
            name: string | null;
            notes: string | null;
            yieldQuantity: Prisma.Decimal;
            yieldUnit: string;
            isActive: boolean;
            items?: { create: Array<Omit<RecipeItemModel, 'id' | 'recipeId' | 'createdAt' | 'updatedAt'>> };
          };
        }) => {
          const now = new Date();
          const recipe: RecipeModel = {
            id: crypto.randomUUID(),
            productId: data.productId,
            name: data.name,
            notes: data.notes,
            yieldQuantity: data.yieldQuantity,
            yieldUnit: data.yieldUnit,
            isActive: data.isActive,
            createdAt: now,
            updatedAt: now,
          };
          recipesStore.set(recipe.id, recipe);
          for (const itemData of data.items?.create ?? []) {
            const item: RecipeItemModel = {
              id: crypto.randomUUID(),
              recipeId: recipe.id,
              materialId: itemData.materialId,
              quantity: itemData.quantity,
              unit: itemData.unit,
              baseQuantity: itemData.baseQuantity,
              baseUnit: itemData.baseUnit,
              notes: itemData.notes ?? null,
              createdAt: now,
              updatedAt: now,
            };
            itemsStore.set(item.id, item);
          }
          return buildRecipeWithRelations(recipe);
        },
      ),
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { id?: string; productId?: string };
          include?: unknown;
        }) => {
          const recipe = where.id
            ? recipesStore.get(where.id)
            : Array.from(recipesStore.values()).find(
                (r) => r.productId === where.productId,
              );
          if (!recipe) return null;
          return include ? buildRecipeWithRelations(recipe) : recipe;
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, any>;
        }) => {
          const existing = recipesStore.get(where.id);
          if (!existing) throw { code: 'P2025' };
          const now = new Date();
          const updated: RecipeModel = {
            ...existing,
            name: data.name !== undefined ? data.name : existing.name,
            notes: data.notes !== undefined ? data.notes : existing.notes,
            yieldQuantity:
              data.yieldQuantity !== undefined
                ? data.yieldQuantity
                : existing.yieldQuantity,
            yieldUnit:
              data.yieldUnit !== undefined
                ? data.yieldUnit
                : existing.yieldUnit,
            isActive:
              data.isActive !== undefined ? data.isActive : existing.isActive,
            updatedAt: now,
          };
          recipesStore.set(existing.id, updated);
          if (data.items?.create) {
            for (const itemData of data.items.create) {
              const item: RecipeItemModel = {
                id: crypto.randomUUID(),
                recipeId: updated.id,
                materialId: itemData.materialId,
                quantity: itemData.quantity,
                unit: itemData.unit,
                baseQuantity: itemData.baseQuantity,
                baseUnit: itemData.baseUnit,
                notes: itemData.notes ?? null,
                createdAt: now,
                updatedAt: now,
              };
              itemsStore.set(item.id, item);
            }
          }
          return buildRecipeWithRelations(updated);
        },
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const existing = recipesStore.get(where.id);
        if (!existing) throw { code: 'P2025' };
        recipesStore.delete(where.id);
        for (const [id, item] of itemsStore.entries()) {
          if (item.recipeId === where.id) itemsStore.delete(id);
        }
        return existing;
      }),
    },
    recipeItem: {
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: {
          where: {
            id?: string;
            recipeId_materialId?: { recipeId: string; materialId: string };
          };
          include?: { material?: boolean };
        }) => {
          let found: RecipeItemModel | undefined;
          if (where.id) {
            found = itemsStore.get(where.id);
          } else if (where.recipeId_materialId) {
            found = Array.from(itemsStore.values()).find(
              (item) =>
                item.recipeId === where.recipeId_materialId!.recipeId &&
                item.materialId === where.recipeId_materialId!.materialId,
            );
          }
          if (!found) return null;
          return include?.material
            ? { ...found, material: materialsStore.get(found.materialId)! }
            : found;
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: Omit<RecipeItemModel, 'id' | 'createdAt' | 'updatedAt'>;
        }) => {
          const now = new Date();
          const item: RecipeItemModel = {
            id: crypto.randomUUID(),
            ...data,
            createdAt: now,
            updatedAt: now,
          };
          itemsStore.set(item.id, item);
          return { ...item, material: materialsStore.get(item.materialId)! };
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<RecipeItemModel>;
        }) => {
          const existing = itemsStore.get(where.id);
          if (!existing) throw { code: 'P2025' };
          const updated: RecipeItemModel = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          itemsStore.set(where.id, updated);
          return {
            ...updated,
            material: materialsStore.get(updated.materialId)!,
          };
        },
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const existing = itemsStore.get(where.id);
        if (!existing) throw { code: 'P2025' };
        itemsStore.delete(where.id);
        return {
          ...existing,
          material: materialsStore.get(existing.materialId)!,
        };
      }),
      deleteMany: vi.fn(
        async ({ where }: { where: { recipeId: string } }) => {
          let count = 0;
          for (const [id, item] of itemsStore.entries()) {
            if (item.recipeId === where.recipeId) {
              itemsStore.delete(id);
              count += 1;
            }
          }
          return { count };
        },
      ),
    },
  };

  let activeProductId: string;
  let inactiveProductId: string;
  let coffeeId: string;
  let milkId: string;
  let sugarId: string;

  beforeEach(async () => {
    productsStore.clear();
    materialsStore.clear();
    recipesStore.clear();
    itemsStore.clear();

    const now = new Date();
    activeProductId = crypto.randomUUID();
    inactiveProductId = crypto.randomUUID();
    coffeeId = crypto.randomUUID();
    milkId = crypto.randomUUID();
    sugarId = crypto.randomUUID();

    productsStore.set(activeProductId, {
      id: activeProductId,
      code: 'PRD-KOPI',
      name: 'Es Kopi Susu',
      category: ProductCategory.BEVERAGE,
      description: 'Es kopi susu signature',
      sellingPrice: new Prisma.Decimal(22000),
      status: ProductStatus.ACTIVE,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    productsStore.set(inactiveProductId, {
      id: inactiveProductId,
      code: 'PRD-NONAKTIF',
      name: 'Menu Nonaktif',
      category: ProductCategory.BEVERAGE,
      description: null,
      sellingPrice: null,
      status: ProductStatus.INACTIVE,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    materialsStore.set(coffeeId, {
      id: coffeeId,
      code: 'BB-KOPI',
      name: 'Kopi Arabika',
      category: MaterialCategory.MAIN,
      unit: MaterialUnit.KILOGRAM,
      purchasePrice: new Prisma.Decimal(120000),
      stock: new Prisma.Decimal(10),
      minStock: new Prisma.Decimal(2),
      stockStatus: StockStatus.AVAILABLE,
      isLowStock: false,
      description: null,
      createdAt: now,
      updatedAt: now,
    });

    materialsStore.set(milkId, {
      id: milkId,
      code: 'BB-SUSU',
      name: 'Susu Full Cream',
      category: MaterialCategory.MAIN,
      unit: MaterialUnit.LITER,
      purchasePrice: new Prisma.Decimal(18000),
      stock: new Prisma.Decimal(20),
      minStock: new Prisma.Decimal(5),
      stockStatus: StockStatus.AVAILABLE,
      isLowStock: false,
      description: null,
      createdAt: now,
      updatedAt: now,
    });

    materialsStore.set(sugarId, {
      id: sugarId,
      code: 'BB-GULA',
      name: 'Gula Aren',
      category: MaterialCategory.SUPPORTING,
      unit: MaterialUnit.KILOGRAM,
      purchasePrice: new Prisma.Decimal(35000),
      stock: new Prisma.Decimal(8),
      minStock: new Prisma.Decimal(2),
      stockStatus: StockStatus.AVAILABLE,
      isLowStock: false,
      description: null,
      createdAt: now,
      updatedAt: now,
    });

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

  afterEach(async () => {
    await app.close();
  });

  it('should handle complete recipe lifecycle, unit conversion, and validation rules', async () => {
    // 1. Reject creating recipe for inactive product (400)
    await request(app.getHttpServer())
      .post(`/api/v1/products/${inactiveProductId}/recipe`)
      .send({
        items: [{ materialId: coffeeId, quantity: 15, unit: MaterialUnit.GRAM }],
      })
      .expect(400);

    // 2. Reject invalid quantity <= 0 (400)
    await request(app.getHttpServer())
      .post(`/api/v1/products/${activeProductId}/recipe`)
      .send({
        items: [{ materialId: coffeeId, quantity: 0, unit: MaterialUnit.GRAM }],
      })
      .expect(400);

    // 3. Reject cross-dimension unit conversion (GRAM on LITER material -> 400)
    await request(app.getHttpServer())
      .post(`/api/v1/products/${activeProductId}/recipe`)
      .send({
        items: [{ materialId: milkId, quantity: 150, unit: MaterialUnit.GRAM }],
      })
      .expect(400);

    // 4. Create recipe with Kopi (15 GRAM -> 0.015 KILOGRAM) & Susu (150 MILLILITER -> 0.15 LITER)
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/products/${activeProductId}/recipe`)
      .send({
        name: 'Resep Es Kopi Susu v1',
        yieldQuantity: 1,
        yieldUnit: 'cup',
        items: [
          { materialId: coffeeId, quantity: 15, unit: MaterialUnit.GRAM },
          { materialId: milkId, quantity: 150, unit: MaterialUnit.MILLILITER },
        ],
      })
      .expect(201);

    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.items).toHaveLength(2);
    expect(createRes.body.data.items[0].baseQuantity).toBe(0.015);
    expect(createRes.body.data.items[0].baseUnit).toBe(MaterialUnit.KILOGRAM);
    expect(createRes.body.data.items[1].baseQuantity).toBe(0.15);
    expect(createRes.body.data.items[1].baseUnit).toBe(MaterialUnit.LITER);

    // 5. Reject duplicate recipe for the same product (409)
    await request(app.getHttpServer())
      .post(`/api/v1/products/${activeProductId}/recipe`)
      .send({
        items: [{ materialId: sugarId, quantity: 20, unit: MaterialUnit.GRAM }],
      })
      .expect(409);

    // 6. Add item Gula Aren (20 GRAM -> 0.02 KILOGRAM)
    const addItemRes = await request(app.getHttpServer())
      .post(`/api/v1/products/${activeProductId}/recipe/items`)
      .send({
        materialId: sugarId,
        quantity: 20,
        unit: MaterialUnit.GRAM,
        notes: 'Gula aren cair',
      })
      .expect(201);

    const sugarItemId: string = addItemRes.body.data.id;
    expect(addItemRes.body.data.baseQuantity).toBe(0.02);

    // 7. Reject adding duplicate material to same recipe (409)
    await request(app.getHttpServer())
      .post(`/api/v1/products/${activeProductId}/recipe/items`)
      .send({
        materialId: sugarId,
        quantity: 10,
        unit: MaterialUnit.GRAM,
      })
      .expect(409);

    // 8. Update item quantity (20 GRAM -> 25 GRAM -> 0.025 KILOGRAM)
    const updateItemRes = await request(app.getHttpServer())
      .patch(`/api/v1/products/${activeProductId}/recipe/items/${sugarItemId}`)
      .send({
        quantity: 25,
      })
      .expect(200);

    expect(updateItemRes.body.data.quantity).toBe(25);
    expect(updateItemRes.body.data.baseQuantity).toBe(0.025);

    // 9. Get full recipe (3 items)
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/products/${activeProductId}/recipe`)
      .expect(200);

    expect(getRes.body.data.items).toHaveLength(3);

    // 10. Delete sugar item
    await request(app.getHttpServer())
      .delete(`/api/v1/products/${activeProductId}/recipe/items/${sugarItemId}`)
      .expect(200);

    // 11. Update recipe metadata via PATCH
    const patchRecipeRes = await request(app.getHttpServer())
      .patch(`/api/v1/products/${activeProductId}/recipe`)
      .send({
        name: 'Resep Es Kopi Susu v2',
      })
      .expect(200);

    expect(patchRecipeRes.body.data.name).toBe('Resep Es Kopi Susu v2');

    // 12. Delete recipe & verify 404 on subsequent GET
    await request(app.getHttpServer())
      .delete(`/api/v1/products/${activeProductId}/recipe`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/products/${activeProductId}/recipe`)
      .expect(404);
  });
});

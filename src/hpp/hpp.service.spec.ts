import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client.js';
import {
  AdditionalCostCategory,
  MaterialCategory,
  MaterialUnit,
  ProductCategory,
  ProductStatus,
  StockStatus,
} from '../../generated/prisma/enums.js';
import type {
  HppAdditionalCostModel,
  HppCalculationModel,
  HppMaterialSnapshotModel,
  MaterialModel,
  ProductModel,
  RecipeItemModel,
  RecipeModel,
} from '../../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HPP_ROUNDING_RULE } from './entities/hpp.entity.js';
import { HppService } from './hpp.service.js';

const PRODUCT_ID = '770e8400-e29b-41d4-a716-446655440000';
const RECIPE_ID = '880e8400-e29b-41d4-a716-446655440000';
const HPP_ID = 'aa0e8400-e29b-41d4-a716-446655440001';
const MAT_KOPI_ID = '550e8400-e29b-41d4-a716-446655440001';
const MAT_SUSU_ID = '550e8400-e29b-41d4-a716-446655440002';
const MAT_GULA_ID = '550e8400-e29b-41d4-a716-446655440003';

function makeProduct(overrides: Partial<ProductModel> = {}): ProductModel {
  return {
    id: PRODUCT_ID,
    code: 'PRD-KOPI-01',
    name: 'Es Kopi Susu',
    category: ProductCategory.BEVERAGE,
    description: 'Es kopi susu gula aren',
    sellingPrice: new Prisma.Decimal(18000),
    status: ProductStatus.ACTIVE,
    isActive: true,
    createdAt: new Date('2026-11-18T08:00:00.000Z'),
    updatedAt: new Date('2026-11-18T08:00:00.000Z'),
    ...overrides,
  };
}

function makeMaterial(overrides: Partial<MaterialModel> = {}): MaterialModel {
  return {
    id: MAT_KOPI_ID,
    code: 'BB-KOPI',
    name: 'Kopi Arabika',
    category: MaterialCategory.MAIN,
    unit: MaterialUnit.GRAM,
    purchasePrice: new Prisma.Decimal(100),
    stock: new Prisma.Decimal(5000),
    minStock: new Prisma.Decimal(500),
    stockStatus: StockStatus.AVAILABLE,
    isLowStock: false,
    description: null,
    createdAt: new Date('2026-11-18T08:00:00.000Z'),
    updatedAt: new Date('2026-11-18T08:00:00.000Z'),
    ...overrides,
  };
}

function makeRecipe(overrides: Partial<RecipeModel> = {}): RecipeModel {
  return {
    id: RECIPE_ID,
    productId: PRODUCT_ID,
    name: 'Resep Es Kopi Susu',
    notes: null,
    yieldQuantity: new Prisma.Decimal(1),
    yieldUnit: 'cup',
    isActive: true,
    createdAt: new Date('2026-11-19T08:00:00.000Z'),
    updatedAt: new Date('2026-11-19T08:00:00.000Z'),
    ...overrides,
  };
}

function makeRecipeItem(
  material: MaterialModel,
  overrides: Partial<RecipeItemModel> = {},
): RecipeItemModel & { material: MaterialModel } {
  return {
    id: crypto.randomUUID(),
    recipeId: RECIPE_ID,
    materialId: material.id,
    quantity: new Prisma.Decimal(15),
    unit: material.unit,
    baseQuantity: new Prisma.Decimal(15),
    baseUnit: material.unit,
    notes: null,
    createdAt: new Date('2026-11-19T08:00:00.000Z'),
    updatedAt: new Date('2026-11-19T08:00:00.000Z'),
    material,
    ...overrides,
  };
}

function makePersistedHpp(
  overrides: Partial<HppCalculationModel> = {},
  snapshots: HppMaterialSnapshotModel[] = [],
  costs: HppAdditionalCostModel[] = [],
) {
  return {
    id: HPP_ID,
    productId: PRODUCT_ID,
    recipeId: RECIPE_ID,
    productCode: 'PRD-KOPI-01',
    productName: 'Es Kopi Susu',
    productCategory: ProductCategory.BEVERAGE,
    productSellingPrice: new Prisma.Decimal(18000),
    recipeName: 'Resep Es Kopi Susu',
    recipeYieldQuantity: new Prisma.Decimal(1),
    recipeYieldUnit: 'cup',
    productionQuantity: new Prisma.Decimal(2),
    totalMaterialCost: new Prisma.Decimal(4800),
    totalAdditionalCost: new Prisma.Decimal(0),
    totalHpp: new Prisma.Decimal(4800),
    hppPerUnit: new Prisma.Decimal(2400),
    roundingRule: HPP_ROUNDING_RULE,
    notes: null,
    calculatedAt: new Date('2026-11-20T09:00:00.000Z'),
    createdAt: new Date('2026-11-20T09:00:00.000Z'),
    materialSnapshots: snapshots,
    additionalCosts: costs,
    ...overrides,
  };
}

describe('HppService', () => {
  let service: HppService;

  const mockPrisma = {
    product: {
      findUnique: vi.fn(),
    },
    hppCalculation: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HppService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<HppService>(HppService);
  });

  describe('calculate (preview without saving)', () => {
    it('should calculate HPP accurately for a single material without persisting', async () => {
      const kopi = makeMaterial({
        id: MAT_KOPI_ID,
        unit: MaterialUnit.GRAM,
        purchasePrice: new Prisma.Decimal(100),
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [makeRecipeItem(kopi, { quantity: new Prisma.Decimal(15) })],
        },
      });

      const result = await service.calculate({
        productId: PRODUCT_ID,
        productionQuantity: 1,
      });

      expect(result.isSaved).toBe(false);
      expect(result.totalMaterialCost).toBe(1500);
      expect(result.totalAdditionalCost).toBe(0);
      expect(result.totalHpp).toBe(1500);
      expect(result.hppPerUnit).toBe(1500);
      expect(result.roundingRule).toBe(HPP_ROUNDING_RULE);
      expect(result.materialSnapshots).toHaveLength(1);
      expect(result.materialSnapshots[0].subtotalCost).toBe(1500);
      expect(mockPrisma.hppCalculation.create).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should calculate multi-material HPP matching Es Kopi Susu manual benchmark (Rp4.800 / 2 = Rp2.400)', async () => {
      const kopi = makeMaterial({
        id: MAT_KOPI_ID,
        code: 'BB-KOPI',
        name: 'Kopi',
        unit: MaterialUnit.GRAM,
        purchasePrice: new Prisma.Decimal(100),
      });
      const susu = makeMaterial({
        id: MAT_SUSU_ID,
        code: 'BB-SUSU',
        name: 'Susu',
        unit: MaterialUnit.MILLILITER,
        purchasePrice: new Prisma.Decimal(20),
      });
      const gula = makeMaterial({
        id: MAT_GULA_ID,
        code: 'BB-GULA',
        name: 'Gula',
        unit: MaterialUnit.GRAM,
        purchasePrice: new Prisma.Decimal(15),
      });

      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [
            makeRecipeItem(kopi, {
              quantity: new Prisma.Decimal(15),
              unit: MaterialUnit.GRAM,
            }),
            makeRecipeItem(susu, {
              quantity: new Prisma.Decimal(150),
              unit: MaterialUnit.MILLILITER,
            }),
            makeRecipeItem(gula, {
              quantity: new Prisma.Decimal(20),
              unit: MaterialUnit.GRAM,
            }),
          ],
        },
      });

      const result = await service.calculate({
        productId: PRODUCT_ID,
        productionQuantity: 2,
      });

      expect(result.totalMaterialCost).toBe(4800);
      expect(result.totalAdditionalCost).toBe(0);
      expect(result.totalHpp).toBe(4800);
      expect(result.productionQuantity).toBe(2);
      expect(result.hppPerUnit).toBe(2400);
      expect(result.materialSnapshots.map((s) => s.subtotalCost)).toEqual([
        1500, 3000, 300,
      ]);
    });

    it('should include additional production costs separately from material costs', async () => {
      const kopi = makeMaterial({
        unit: MaterialUnit.GRAM,
        purchasePrice: new Prisma.Decimal(100),
      });

      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [makeRecipeItem(kopi, { quantity: new Prisma.Decimal(15) })],
        },
      });

      const result = await service.calculate({
        productId: PRODUCT_ID,
        productionQuantity: 2,
        additionalCosts: [
          {
            category: AdditionalCostCategory.LABOR,
            name: 'Tenaga Kerja Barista',
            amount: 2000,
            notes: '10 menit',
          },
          {
            category: AdditionalCostCategory.ELECTRICITY,
            name: 'Listrik Mesin Espresso',
            amount: 500,
          },
          {
            category: AdditionalCostCategory.GAS,
            name: 'Gas',
            amount: 300,
          },
          {
            category: AdditionalCostCategory.WATER,
            name: 'Air Galon',
            amount: 200,
          },
          {
            name: 'Biaya Operasional Lainnya',
            amount: 500,
          },
        ],
      });

      // Material: 1500; Additional: 2000 + 500 + 300 + 200 + 500 = 3500; Total: 5000; / 2 = 2500
      expect(result.totalMaterialCost).toBe(1500);
      expect(result.totalAdditionalCost).toBe(3500);
      expect(result.totalHpp).toBe(5000);
      expect(result.hppPerUnit).toBe(2500);
      expect(result.additionalCosts).toHaveLength(5);
      expect(result.additionalCosts[4].category).toBe(
        AdditionalCostCategory.OTHER,
      );
    });

    it('should apply ROUND_HALF_UP to 2 decimal places for HPP per unit', async () => {
      const kopi = makeMaterial({
        unit: MaterialUnit.GRAM,
        purchasePrice: new Prisma.Decimal(1000),
      });

      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [makeRecipeItem(kopi, { quantity: new Prisma.Decimal(10) })], // 10,000
        },
      });

      // 10000 / 3 = 3333.3333... -> 3333.33
      const divBy3 = await service.calculate({
        productId: PRODUCT_ID,
        productionQuantity: 3,
      });
      expect(divBy3.hppPerUnit).toBe(3333.33);

      // 10000 / 6 = 1666.6666... -> 1666.67
      const divBy6 = await service.calculate({
        productId: PRODUCT_ID,
        productionQuantity: 6,
      });
      expect(divBy6.hppPerUnit).toBe(1666.67);

      // Exact half-up boundary: totalHpp = 10000 + 0.01 = 10000.01; / 2 = 5000.005 -> 5000.01
      const halfUp = await service.calculate({
        productId: PRODUCT_ID,
        productionQuantity: 2,
        additionalCosts: [{ name: 'Rounding test', amount: 0.01 }],
      });
      expect(halfUp.totalHpp).toBe(10000.01);
      expect(halfUp.hppPerUnit).toBe(5000.01);
    });

    it('should dynamically convert compatible units (GRAM->KILOGRAM, ML->LITER, PIECE->DOZEN)', async () => {
      const kopiKg = makeMaterial({
        id: MAT_KOPI_ID,
        code: 'BB-KOPI-KG',
        name: 'Kopi',
        unit: MaterialUnit.KILOGRAM,
        purchasePrice: new Prisma.Decimal(100000), // Rp100.000/kg = Rp100/g
      });
      const susuL = makeMaterial({
        id: MAT_SUSU_ID,
        code: 'BB-SUSU-L',
        name: 'Susu',
        unit: MaterialUnit.LITER,
        purchasePrice: new Prisma.Decimal(20000), // Rp20.000/L = Rp20/ml
      });
      const cupDozen = makeMaterial({
        id: MAT_GULA_ID,
        code: 'BB-CUP-DZ',
        name: 'Cup Plastik',
        unit: MaterialUnit.DOZEN,
        purchasePrice: new Prisma.Decimal(12000), // Rp12.000/lusin = Rp1.000/pcs
      });

      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [
            makeRecipeItem(kopiKg, {
              quantity: new Prisma.Decimal(15),
              unit: MaterialUnit.GRAM,
              baseQuantity: new Prisma.Decimal(999), // stale value should be ignored!
              baseUnit: MaterialUnit.GRAM,
            }),
            makeRecipeItem(susuL, {
              quantity: new Prisma.Decimal(150),
              unit: MaterialUnit.MILLILITER,
              baseQuantity: new Prisma.Decimal(0.15),
              baseUnit: MaterialUnit.LITER,
            }),
            makeRecipeItem(cupDozen, {
              quantity: new Prisma.Decimal(3),
              unit: MaterialUnit.PIECE,
              baseQuantity: new Prisma.Decimal(0.25),
              baseUnit: MaterialUnit.DOZEN,
            }),
          ],
        },
      });

      const result = await service.calculate({
        productId: PRODUCT_ID,
        productionQuantity: 1,
      });

      // Kopi: 0.015 kg * 100000 = 1500
      // Susu: 0.15 L * 20000 = 3000
      // Cup: 0.25 dozen * 12000 = 3000
      expect(result.materialSnapshots[0].baseQuantity).toBe(0.015);
      expect(result.materialSnapshots[0].baseUnit).toBe(MaterialUnit.KILOGRAM);
      expect(result.materialSnapshots[0].subtotalCost).toBe(1500);
      expect(result.materialSnapshots[1].baseQuantity).toBe(0.15);
      expect(result.materialSnapshots[1].subtotalCost).toBe(3000);
      expect(result.materialSnapshots[2].baseQuantity).toBe(0.25);
      expect(result.materialSnapshots[2].subtotalCost).toBe(3000);
      expect(result.totalMaterialCost).toBe(7500);
      expect(result.hppPerUnit).toBe(7500);
    });

    it('should fall back to recipe yieldQuantity when productionQuantity is omitted', async () => {
      const kopi = makeMaterial({
        unit: MaterialUnit.GRAM,
        purchasePrice: new Prisma.Decimal(100),
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe({ yieldQuantity: new Prisma.Decimal(4) }),
          items: [makeRecipeItem(kopi, { quantity: new Prisma.Decimal(40) })], // 4000
        },
      });

      const result = await service.calculate({ productId: PRODUCT_ID });
      expect(result.productionQuantity).toBe(4);
      expect(result.hppPerUnit).toBe(1000);
    });

    it('should reject incompatible cross-dimension units (GRAM vs MILLILITER)', async () => {
      const susu = makeMaterial({
        id: MAT_SUSU_ID,
        unit: MaterialUnit.MILLILITER,
        purchasePrice: new Prisma.Decimal(20),
      });

      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [
            makeRecipeItem(susu, {
              quantity: new Prisma.Decimal(100),
              unit: MaterialUnit.GRAM, // incompatible with MILLILITER
            }),
          ],
        },
      });

      await expect(
        service.calculate({ productId: PRODUCT_ID, productionQuantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when product is not found (404)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.calculate({ productId: PRODUCT_ID, productionQuantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when product is inactive (400)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct({ status: ProductStatus.INACTIVE, isActive: false }),
        recipe: { ...makeRecipe(), items: [makeRecipeItem(makeMaterial())] },
      });

      await expect(
        service.calculate({ productId: PRODUCT_ID, productionQuantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when product has no recipe (400)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: null,
      });

      await expect(
        service.calculate({ productId: PRODUCT_ID, productionQuantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when recipe is inactive (400)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe({ isActive: false }),
          items: [makeRecipeItem(makeMaterial())],
        },
      });

      await expect(
        service.calculate({ productId: PRODUCT_ID, productionQuantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when recipe has no material items (400)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [],
        },
      });

      await expect(
        service.calculate({ productId: PRODUCT_ID, productionQuantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when material has negative purchase price (400)', async () => {
      const badMaterial = makeMaterial({
        purchasePrice: new Prisma.Decimal(-500),
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [makeRecipeItem(badMaterial)],
        },
      });

      await expect(
        service.calculate({ productId: PRODUCT_ID, productionQuantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative additional cost amount or non-positive productionQuantity', async () => {
      await expect(
        service.calculate({ productId: PRODUCT_ID, productionQuantity: 0 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.calculate({ productId: PRODUCT_ID, productionQuantity: -2 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.calculate({
          productId: PRODUCT_ID,
          productionQuantity: 1,
          additionalCosts: [{ name: 'Listrik', amount: -100 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create (persist snapshot inside transaction)', () => {
    it('should persist HPP calculation, material snapshots, and additional costs atomically in $transaction', async () => {
      const kopi = makeMaterial({
        id: MAT_KOPI_ID,
        unit: MaterialUnit.GRAM,
        purchasePrice: new Prisma.Decimal(100),
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [makeRecipeItem(kopi, { quantity: new Prisma.Decimal(15) })],
        },
      });

      mockPrisma.hppCalculation.create.mockImplementation(
        async ({
          data,
        }: {
          data: {
            productId: string;
            recipeId: string;
            totalMaterialCost: Prisma.Decimal;
            totalAdditionalCost: Prisma.Decimal;
            totalHpp: Prisma.Decimal;
            hppPerUnit: Prisma.Decimal;
            productionQuantity: Prisma.Decimal;
            materialSnapshots: { create: Array<Record<string, unknown>> };
            additionalCosts: { create: Array<Record<string, unknown>> };
          };
        }) =>
          makePersistedHpp(
            {
              totalMaterialCost: data.totalMaterialCost,
              totalAdditionalCost: data.totalAdditionalCost,
              totalHpp: data.totalHpp,
              hppPerUnit: data.hppPerUnit,
              productionQuantity: data.productionQuantity,
            },
            data.materialSnapshots.create.map((s) => ({
              id: crypto.randomUUID(),
              hppCalculationId: HPP_ID,
              createdAt: new Date(),
              ...(s as unknown as Omit<
                HppMaterialSnapshotModel,
                'id' | 'hppCalculationId' | 'createdAt'
              >),
            })),
            data.additionalCosts.create.map((c) => ({
              id: crypto.randomUUID(),
              hppCalculationId: HPP_ID,
              createdAt: new Date(),
              ...(c as unknown as Omit<
                HppAdditionalCostModel,
                'id' | 'hppCalculationId' | 'createdAt'
              >),
            })),
          ),
      );

      const saved = await service.create({
        productId: PRODUCT_ID,
        productionQuantity: 2,
        additionalCosts: [
          {
            category: AdditionalCostCategory.ELECTRICITY,
            name: 'Listrik',
            amount: 500,
          },
        ],
        notes: 'Batch pagi',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.hppCalculation.create).toHaveBeenCalledTimes(1);
      expect(saved.isSaved).toBe(true);
      expect(saved.id).toBe(HPP_ID);
      expect(saved.totalMaterialCost).toBe(1500);
      expect(saved.totalAdditionalCost).toBe(500);
      expect(saved.totalHpp).toBe(2000);
      expect(saved.hppPerUnit).toBe(1000);
      expect(saved.materialSnapshots).toHaveLength(1);
      expect(saved.materialSnapshots[0].unitPrice).toBe(100);
      expect(saved.additionalCosts).toHaveLength(1);
      expect(saved.additionalCosts[0].name).toBe('Listrik');
    });

    it('should propagate transaction failure when database write fails', async () => {
      const kopi = makeMaterial();
      mockPrisma.product.findUnique.mockResolvedValue({
        ...makeProduct(),
        recipe: {
          ...makeRecipe(),
          items: [makeRecipeItem(kopi)],
        },
      });
      mockPrisma.hppCalculation.create.mockRejectedValue(
        new Error('Simulated DB write failure'),
      );

      await expect(
        service.create({ productId: PRODUCT_ID, productionQuantity: 1 }),
      ).rejects.toThrow('An unexpected database error occurred');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('history queries (findAll, findOne, findLatestByProduct)', () => {
    it('should return paginated HPP history filtered by productId, search, and date range', async () => {
      mockPrisma.hppCalculation.findMany.mockResolvedValue([
        makePersistedHpp(),
      ]);
      mockPrisma.hppCalculation.count.mockResolvedValue(1);

      const result = await service.findAll({
        productId: PRODUCT_ID,
        search: 'Kopi',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-30',
        page: 1,
        limit: 10,
        sortBy: 'totalHpp',
        sortOrder: 'desc',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrisma.hppCalculation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: PRODUCT_ID,
            calculatedAt: {
              gte: new Date('2026-11-01T00:00:00.000Z'),
              lte: new Date('2026-11-30T23:59:59.999Z'),
            },
          }),
          orderBy: { totalHpp: 'desc' },
        }),
      );
    });

    it('should reject when dateFrom is after dateTo', async () => {
      await expect(
        service.findAll({
          dateFrom: '2026-11-30',
          dateTo: '2026-11-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return 404 when HPP detail is not found', async () => {
      mockPrisma.hppCalculation.findUnique.mockResolvedValue(null);
      await expect(service.findOne(HPP_ID)).rejects.toThrow(NotFoundException);
    });

    it('should return latest HPP for a product and 404 when none exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(makeProduct());
      mockPrisma.hppCalculation.findFirst.mockResolvedValue(makePersistedHpp());

      const latest = await service.findLatestByProduct(PRODUCT_ID);
      expect(latest.id).toBe(HPP_ID);
      expect(latest.hppPerUnit).toBe(2400);

      mockPrisma.hppCalculation.findFirst.mockResolvedValue(null);
      await expect(service.findLatestByProduct(PRODUCT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

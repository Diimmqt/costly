import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client.js';
import {
  MaterialCategory,
  MaterialUnit,
  ProductCategory,
  ProductStatus,
  StockStatus,
} from '../../generated/prisma/enums.js';
import type {
  MaterialModel,
  ProductModel,
} from '../../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  RecipeItemWithMaterial,
  RecipeWithRelations,
} from './entities/recipe.entity.js';
import { RecipesService } from './recipes.service.js';

const BASE_DATE = new Date('2026-11-19T08:00:00.000Z');
const PRODUCT_ID = '770e8400-e29b-41d4-a716-446655440000';
const RECIPE_ID = '880e8400-e29b-41d4-a716-446655440000';
const COFFEE_ID = '550e8400-e29b-41d4-a716-446655440001';
const MILK_ID = '550e8400-e29b-41d4-a716-446655440002';
const SUGAR_ID = '550e8400-e29b-41d4-a716-446655440003';
const ITEM_COFFEE_ID = '990e8400-e29b-41d4-a716-446655440001';
const ITEM_MILK_ID = '990e8400-e29b-41d4-a716-446655440002';

function createMockProduct(
  overrides: Partial<ProductModel> = {},
): ProductModel {
  return {
    id: PRODUCT_ID,
    code: 'PRD-001',
    name: 'Es Kopi Susu',
    category: ProductCategory.BEVERAGE,
    description: 'Es kopi susu signature',
    sellingPrice: new Prisma.Decimal(22000),
    status: ProductStatus.ACTIVE,
    isActive: true,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

function createMockMaterial(
  overrides: Partial<MaterialModel> = {},
): MaterialModel {
  return {
    id: COFFEE_ID,
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
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

function createMockRecipeItem(
  overrides: Partial<RecipeItemWithMaterial> = {},
): RecipeItemWithMaterial {
  const material = overrides.material ?? createMockMaterial();
  return {
    id: ITEM_COFFEE_ID,
    recipeId: RECIPE_ID,
    materialId: material.id,
    quantity: new Prisma.Decimal(15),
    unit: MaterialUnit.GRAM,
    baseQuantity: new Prisma.Decimal(0.015),
    baseUnit: material.unit,
    notes: 'Single shot espresso',
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    material,
    ...overrides,
  };
}

function createMockRecipe(
  overrides: Partial<RecipeWithRelations> = {},
): RecipeWithRelations {
  return {
    id: RECIPE_ID,
    productId: PRODUCT_ID,
    name: 'Recipe - Es Kopi Susu',
    notes: 'Standar cup 250ml',
    yieldQuantity: new Prisma.Decimal(1),
    yieldUnit: 'cup',
    isActive: true,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    product: createMockProduct(),
    items: [createMockRecipeItem()],
    ...overrides,
  };
}

describe('RecipesService', () => {
  let service: RecipesService;
  let mockPrisma: {
    product: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    material: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    recipe: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    recipeItem: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockPrisma = {
      product: {
        findUnique: vi.fn(),
      },
      material: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      recipe: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      recipeItem: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(
        async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
          callback(mockPrisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<RecipesService>(RecipesService);
  });

  describe('create (Create Recipe & Validation)', () => {
    it('should create a recipe with converted base quantities without deducting stock', async () => {
      const product = { ...createMockProduct(), recipe: null };
      const coffee = createMockMaterial({
        id: COFFEE_ID,
        unit: MaterialUnit.KILOGRAM,
      });
      const milk = createMockMaterial({
        id: MILK_ID,
        code: 'BB-SUSU',
        name: 'Susu Full Cream',
        unit: MaterialUnit.LITER,
        purchasePrice: new Prisma.Decimal(18000),
      });

      const createdRecipe = createMockRecipe({
        items: [
          createMockRecipeItem({
            id: ITEM_COFFEE_ID,
            materialId: COFFEE_ID,
            quantity: new Prisma.Decimal(15),
            unit: MaterialUnit.GRAM,
            baseQuantity: new Prisma.Decimal(0.015),
            baseUnit: MaterialUnit.KILOGRAM,
            material: coffee,
          }),
          createMockRecipeItem({
            id: ITEM_MILK_ID,
            materialId: MILK_ID,
            quantity: new Prisma.Decimal(150),
            unit: MaterialUnit.MILLILITER,
            baseQuantity: new Prisma.Decimal(0.15),
            baseUnit: MaterialUnit.LITER,
            material: milk,
          }),
        ],
      });

      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.material.findMany.mockResolvedValue([coffee, milk]);
      mockPrisma.recipe.create.mockResolvedValue(createdRecipe);

      const result = await service.create(PRODUCT_ID, {
        yieldQuantity: 1,
        yieldUnit: 'cup',
        items: [
          { materialId: COFFEE_ID, quantity: 15, unit: MaterialUnit.GRAM },
          { materialId: MILK_ID, quantity: 150, unit: MaterialUnit.MILLILITER },
        ],
      });

      expect(mockPrisma.recipe.create).toHaveBeenCalledOnce();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].baseQuantity).toBe(0.015);
      expect(result.items[0].baseUnit).toBe(MaterialUnit.KILOGRAM);
      expect(result.items[1].baseQuantity).toBe(0.15);
      expect(result.items[1].baseUnit).toBe(MaterialUnit.LITER);
    });

    it('should throw NotFoundException (404) when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create(PRODUCT_ID, {
          items: [
            { materialId: COFFEE_ID, quantity: 15, unit: MaterialUnit.GRAM },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException (400) when creating a recipe for an inactive product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...createMockProduct({
          status: ProductStatus.INACTIVE,
          isActive: false,
        }),
        recipe: null,
      });

      await expect(
        service.create(PRODUCT_ID, {
          items: [
            { materialId: COFFEE_ID, quantity: 15, unit: MaterialUnit.GRAM },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException (409) when product already has a recipe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...createMockProduct(),
        recipe: { id: RECIPE_ID },
      });

      await expect(
        service.create(PRODUCT_ID, {
          items: [
            { materialId: COFFEE_ID, quantity: 15, unit: MaterialUnit.GRAM },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException (409) when duplicate materialId is sent in items', async () => {
      await expect(
        service.create(PRODUCT_ID, {
          items: [
            { materialId: COFFEE_ID, quantity: 15, unit: MaterialUnit.GRAM },
            { materialId: COFFEE_ID, quantity: 10, unit: MaterialUnit.GRAM },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException (404) when any material does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...createMockProduct(),
        recipe: null,
      });
      mockPrisma.material.findMany.mockResolvedValue([]);

      await expect(
        service.create(PRODUCT_ID, {
          items: [
            { materialId: COFFEE_ID, quantity: 15, unit: MaterialUnit.GRAM },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException (400) when usage unit is incompatible with material base unit (e.g., GRAM vs LITER)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...createMockProduct(),
        recipe: null,
      });
      mockPrisma.material.findMany.mockResolvedValue([
        createMockMaterial({ id: MILK_ID, unit: MaterialUnit.LITER }),
      ]);

      await expect(
        service.create(PRODUCT_ID, {
          items: [
            { materialId: MILK_ID, quantity: 150, unit: MaterialUnit.GRAM },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException (400) when quantity <= 0 or items is empty', async () => {
      await expect(
        service.create(PRODUCT_ID, { items: [] }),
      ).rejects.toThrow(BadRequestException);

      mockPrisma.product.findUnique.mockResolvedValue({
        ...createMockProduct(),
        recipe: null,
      });
      mockPrisma.material.findMany.mockResolvedValue([createMockMaterial()]);

      await expect(
        service.create(PRODUCT_ID, {
          items: [
            { materialId: COFFEE_ID, quantity: 0, unit: MaterialUnit.GRAM },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByProduct & updateByProduct & removeByProduct', () => {
    it('should retrieve a recipe by productId and throw 404 when recipe is missing', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(createMockProduct());
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(createMockRecipe());

      const found = await service.findByProduct(PRODUCT_ID);
      expect(found.id).toBe(RECIPE_ID);
      expect(found.product.code).toBe('PRD-001');

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);
      await expect(service.findByProduct(PRODUCT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update recipe metadata and replace items atomically', async () => {
      const sugar = createMockMaterial({
        id: SUGAR_ID,
        code: 'BB-GULA',
        name: 'Gula Aren',
        unit: MaterialUnit.KILOGRAM,
      });
      mockPrisma.product.findUnique.mockResolvedValue(createMockProduct());
      mockPrisma.recipe.findUnique.mockResolvedValue(createMockRecipe());
      mockPrisma.material.findMany.mockResolvedValue([sugar]);
      mockPrisma.recipeItem.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.recipe.update.mockResolvedValue(
        createMockRecipe({
          name: 'Resep Baru',
          items: [
            createMockRecipeItem({
              materialId: SUGAR_ID,
              quantity: new Prisma.Decimal(20),
              unit: MaterialUnit.GRAM,
              baseQuantity: new Prisma.Decimal(0.02),
              baseUnit: MaterialUnit.KILOGRAM,
              material: sugar,
            }),
          ],
        }),
      );

      const updated = await service.updateByProduct(PRODUCT_ID, {
        name: 'Resep Baru',
        items: [{ materialId: SUGAR_ID, quantity: 20, unit: MaterialUnit.GRAM }],
      });

      expect(mockPrisma.recipeItem.deleteMany).toHaveBeenCalledWith({
        where: { recipeId: RECIPE_ID },
      });
      expect(updated.name).toBe('Resep Baru');
      expect(updated.items[0].baseQuantity).toBe(0.02);
    });

    it('should prevent deleting recipe when related HPP/production data exists (409 Conflict)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(createMockProduct());
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...createMockRecipe(),
        _count: { items: 2, hppCalculations: 1 },
      });

      await expect(service.removeByProduct(PRODUCT_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.recipe.delete).not.toHaveBeenCalled();

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(createMockRecipe());
      mockPrisma.recipe.delete.mockRejectedValueOnce({ code: 'P2003' });

      await expect(service.removeByProduct(PRODUCT_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('addItem & updateItem & removeItem (Recipe Item Operations)', () => {
    it('should add a material item to an existing recipe and reject duplicates', async () => {
      const milk = createMockMaterial({
        id: MILK_ID,
        code: 'BB-SUSU',
        name: 'Susu Full Cream',
        unit: MaterialUnit.LITER,
      });

      mockPrisma.product.findUnique.mockResolvedValue(createMockProduct());
      mockPrisma.recipe.findUnique.mockResolvedValue(createMockRecipe());
      mockPrisma.material.findUnique.mockResolvedValue(milk);
      mockPrisma.recipeItem.findUnique.mockResolvedValueOnce(null);
      mockPrisma.recipeItem.create.mockResolvedValue(
        createMockRecipeItem({
          id: ITEM_MILK_ID,
          materialId: MILK_ID,
          quantity: new Prisma.Decimal(150),
          unit: MaterialUnit.MILLILITER,
          baseQuantity: new Prisma.Decimal(0.15),
          baseUnit: MaterialUnit.LITER,
          material: milk,
        }),
      );

      const added = await service.addItem(PRODUCT_ID, {
        materialId: MILK_ID,
        quantity: 150,
        unit: MaterialUnit.MILLILITER,
      });

      expect(added.baseQuantity).toBe(0.15);
      expect(added.baseUnit).toBe(MaterialUnit.LITER);

      // Duplicate item rejected with 409
      mockPrisma.recipeItem.findUnique.mockResolvedValueOnce({
        id: ITEM_MILK_ID,
      });
      await expect(
        service.addItem(PRODUCT_ID, {
          materialId: MILK_ID,
          quantity: 100,
          unit: MaterialUnit.MILLILITER,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update item quantity & recalculate baseQuantity, and reject item from another recipe', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(createMockProduct());
      mockPrisma.recipe.findUnique.mockResolvedValue(createMockRecipe());
      mockPrisma.recipeItem.findUnique.mockResolvedValueOnce(
        createMockRecipeItem(),
      );
      mockPrisma.recipeItem.update.mockResolvedValue(
        createMockRecipeItem({
          quantity: new Prisma.Decimal(25),
          baseQuantity: new Prisma.Decimal(0.025),
        }),
      );

      const updated = await service.updateItem(PRODUCT_ID, ITEM_COFFEE_ID, {
        quantity: 25,
      });
      expect(updated.quantity).toBe(25);
      expect(updated.baseQuantity).toBe(0.025);

      // Item belonging to a different recipe rejected with 404
      mockPrisma.recipeItem.findUnique.mockResolvedValueOnce(
        createMockRecipeItem({
          recipeId: '00000000-0000-0000-0000-000000000099',
        }),
      );
      await expect(
        service.updateItem(PRODUCT_ID, ITEM_COFFEE_ID, { quantity: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should remove an item from the product recipe', async () => {
      const item = createMockRecipeItem();
      mockPrisma.product.findUnique.mockResolvedValue(createMockProduct());
      mockPrisma.recipe.findUnique.mockResolvedValue(createMockRecipe());
      mockPrisma.recipeItem.findUnique.mockResolvedValue(item);
      mockPrisma.recipeItem.delete.mockResolvedValue(item);

      const removed = await service.removeItem(PRODUCT_ID, ITEM_COFFEE_ID);
      expect(removed.id).toBe(ITEM_COFFEE_ID);
      expect(mockPrisma.recipeItem.delete).toHaveBeenCalledWith({
        where: { id: ITEM_COFFEE_ID },
        include: { material: true },
      });
    });

    it('should translate unexpected database errors to InternalServerErrorException (500)', async () => {
      mockPrisma.product.findUnique.mockRejectedValueOnce(
        new Error('Unexpected DB failure'),
      );

      await expect(service.findByProduct(PRODUCT_ID)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});

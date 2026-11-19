import { Test, TestingModule } from '@nestjs/testing';
import {
  MaterialCategory,
  MaterialUnit,
  ProductCategory,
  ProductStatus,
  StockStatus,
} from '../../generated/prisma/enums.js';
import type {
  RecipeEntity,
  RecipeItemEntity,
} from './entities/recipe.entity.js';
import { RecipesController } from './recipes.controller.js';
import { RecipesService } from './recipes.service.js';

const PRODUCT_ID = '770e8400-e29b-41d4-a716-446655440000';
const RECIPE_ID = '880e8400-e29b-41d4-a716-446655440000';
const MATERIAL_ID = '550e8400-e29b-41d4-a716-446655440001';
const ITEM_ID = '990e8400-e29b-41d4-a716-446655440001';

const MOCK_ITEM: RecipeItemEntity = {
  id: ITEM_ID,
  recipeId: RECIPE_ID,
  materialId: MATERIAL_ID,
  quantity: 15,
  unit: MaterialUnit.GRAM,
  baseQuantity: 0.015,
  baseUnit: MaterialUnit.KILOGRAM,
  notes: null,
  createdAt: new Date('2026-11-19T08:00:00.000Z'),
  updatedAt: new Date('2026-11-19T08:00:00.000Z'),
  material: {
    id: MATERIAL_ID,
    code: 'BB-KOPI',
    name: 'Kopi Arabika',
    category: MaterialCategory.MAIN,
    unit: MaterialUnit.KILOGRAM,
    purchasePrice: 120000,
    stock: 10,
    stockStatus: StockStatus.AVAILABLE,
    isLowStock: false,
  },
};

const MOCK_RECIPE: RecipeEntity = {
  id: RECIPE_ID,
  productId: PRODUCT_ID,
  name: 'Recipe - Es Kopi Susu',
  notes: null,
  yieldQuantity: 1,
  yieldUnit: 'cup',
  isActive: true,
  createdAt: new Date('2026-11-19T08:00:00.000Z'),
  updatedAt: new Date('2026-11-19T08:00:00.000Z'),
  product: {
    id: PRODUCT_ID,
    code: 'PRD-001',
    name: 'Es Kopi Susu',
    category: ProductCategory.BEVERAGE,
    sellingPrice: 22000,
    status: ProductStatus.ACTIVE,
    isActive: true,
  },
  items: [MOCK_ITEM],
};

describe('RecipesController', () => {
  let controller: RecipesController;
  let mockService: {
    findByProduct: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateByProduct: ReturnType<typeof vi.fn>;
    removeByProduct: ReturnType<typeof vi.fn>;
    addItem: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      findByProduct: vi.fn().mockResolvedValue(MOCK_RECIPE),
      create: vi.fn().mockResolvedValue(MOCK_RECIPE),
      updateByProduct: vi.fn().mockResolvedValue(MOCK_RECIPE),
      removeByProduct: vi.fn().mockResolvedValue(MOCK_RECIPE),
      addItem: vi.fn().mockResolvedValue(MOCK_ITEM),
      updateItem: vi.fn().mockResolvedValue({ ...MOCK_ITEM, quantity: 20 }),
      removeItem: vi.fn().mockResolvedValue(MOCK_ITEM),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipesController],
      providers: [
        {
          provide: RecipesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<RecipesController>(RecipesController);
  });

  it('GET /products/:productId/recipe should return formatted recipe', async () => {
    const res = await controller.findByProduct(PRODUCT_ID);
    expect(res).toEqual({
      success: true,
      message: 'Recipe retrieved successfully',
      data: MOCK_RECIPE,
    });
  });

  it('POST /products/:productId/recipe should return formatted created recipe', async () => {
    const res = await controller.create(PRODUCT_ID, {
      items: [{ materialId: MATERIAL_ID, quantity: 15, unit: MaterialUnit.GRAM }],
    });
    expect(res).toEqual({
      success: true,
      message: 'Recipe created successfully',
      data: MOCK_RECIPE,
    });
  });

  it('PATCH /products/:productId/recipe should return formatted updated recipe', async () => {
    const res = await controller.update(PRODUCT_ID, { name: 'Updated' });
    expect(res).toEqual({
      success: true,
      message: 'Recipe updated successfully',
      data: MOCK_RECIPE,
    });
  });

  it('DELETE /products/:productId/recipe should return formatted deleted recipe', async () => {
    const res = await controller.remove(PRODUCT_ID);
    expect(res).toEqual({
      success: true,
      message: 'Recipe deleted successfully',
      data: MOCK_RECIPE,
    });
  });

  it('POST /products/:productId/recipe/items should return formatted added item', async () => {
    const res = await controller.addItem(PRODUCT_ID, {
      materialId: MATERIAL_ID,
      quantity: 15,
      unit: MaterialUnit.GRAM,
    });
    expect(res).toEqual({
      success: true,
      message: 'Recipe item added successfully',
      data: MOCK_ITEM,
    });
  });

  it('PATCH /products/:productId/recipe/items/:itemId should return formatted updated item', async () => {
    const res = await controller.updateItem(PRODUCT_ID, ITEM_ID, {
      quantity: 20,
    });
    expect(res.success).toBe(true);
    expect(res.data.quantity).toBe(20);
  });

  it('DELETE /products/:productId/recipe/items/:itemId should return formatted deleted item', async () => {
    const res = await controller.removeItem(PRODUCT_ID, ITEM_ID);
    expect(res).toEqual({
      success: true,
      message: 'Recipe item removed successfully',
      data: MOCK_ITEM,
    });
  });
});

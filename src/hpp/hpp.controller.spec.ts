import { Test, TestingModule } from '@nestjs/testing';
import {
  AdditionalCostCategory,
  MaterialCategory,
  MaterialUnit,
  ProductCategory,
} from '../../generated/prisma/enums.js';
import {
  HPP_ROUNDING_RULE,
  type HppCalculationEntity,
  type HppPreviewEntity,
} from './entities/hpp.entity.js';
import { HppController } from './hpp.controller.js';
import { HppService } from './hpp.service.js';
import { ProductHppController } from './product-hpp.controller.js';

const PRODUCT_ID = '770e8400-e29b-41d4-a716-446655440000';
const RECIPE_ID = '880e8400-e29b-41d4-a716-446655440000';
const HPP_ID = 'aa0e8400-e29b-41d4-a716-446655440001';
const MAT_ID = '550e8400-e29b-41d4-a716-446655440001';

const MOCK_PREVIEW: HppPreviewEntity = {
  isSaved: false,
  productId: PRODUCT_ID,
  recipeId: RECIPE_ID,
  productCode: 'PRD-001',
  productName: 'Es Kopi Susu',
  productCategory: ProductCategory.BEVERAGE,
  productSellingPrice: 18000,
  recipeName: 'Resep Es Kopi Susu',
  recipeYieldQuantity: 1,
  recipeYieldUnit: 'cup',
  productionQuantity: 2,
  totalMaterialCost: 4800,
  totalAdditionalCost: 1200,
  totalHpp: 6000,
  hppPerUnit: 3000,
  roundingRule: HPP_ROUNDING_RULE,
  notes: null,
  calculatedAt: new Date('2026-11-20T09:00:00.000Z'),
  materialSnapshots: [
    {
      materialId: MAT_ID,
      materialCode: 'BB-KOPI',
      materialName: 'Kopi',
      materialCategory: MaterialCategory.MAIN,
      usageQuantity: 15,
      usageUnit: MaterialUnit.GRAM,
      baseQuantity: 15,
      baseUnit: MaterialUnit.GRAM,
      unitPrice: 100,
      subtotalCost: 1500,
      notes: null,
    },
  ],
  additionalCosts: [
    {
      category: AdditionalCostCategory.ELECTRICITY,
      name: 'Listrik',
      amount: 1200,
      notes: null,
    },
  ],
};

const MOCK_SAVED: HppCalculationEntity = {
  ...MOCK_PREVIEW,
  id: HPP_ID,
  isSaved: true,
  createdAt: new Date('2026-11-20T09:00:00.000Z'),
};

describe('HppController & ProductHppController', () => {
  let hppController: HppController;
  let productHppController: ProductHppController;
  let mockService: {
    calculate: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findLatestByProduct: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      calculate: vi.fn().mockResolvedValue(MOCK_PREVIEW),
      create: vi.fn().mockResolvedValue(MOCK_SAVED),
      findAll: vi.fn().mockResolvedValue({
        data: [MOCK_SAVED],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
      findOne: vi.fn().mockResolvedValue(MOCK_SAVED),
      findLatestByProduct: vi.fn().mockResolvedValue(MOCK_SAVED),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HppController, ProductHppController],
      providers: [
        {
          provide: HppService,
          useValue: mockService,
        },
      ],
    }).compile();

    hppController = module.get<HppController>(HppController);
    productHppController =
      module.get<ProductHppController>(ProductHppController);
  });

  it('POST /hpp/calculate should return preview calculation', async () => {
    const res = await hppController.calculate({
      productId: PRODUCT_ID,
      productionQuantity: 2,
    });
    expect(res).toEqual({
      success: true,
      message: 'HPP calculated successfully (preview)',
      data: MOCK_PREVIEW,
    });
  });

  it('POST /hpp should return saved calculation', async () => {
    const res = await hppController.create({
      productId: PRODUCT_ID,
      productionQuantity: 2,
    });
    expect(res).toEqual({
      success: true,
      message: 'HPP calculation saved successfully',
      data: MOCK_SAVED,
    });
  });

  it('GET /hpp should return paginated calculation history', async () => {
    const res = await hppController.findAll({ page: 1, limit: 10 });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.meta?.total).toBe(1);
  });

  it('GET /hpp/:id should return calculation detail', async () => {
    const res = await hppController.findOne(HPP_ID);
    expect(res).toEqual({
      success: true,
      message: 'HPP calculation retrieved successfully',
      data: MOCK_SAVED,
    });
  });

  it('GET /products/:productId/hpp/latest should return latest calculation for product', async () => {
    const res = await productHppController.findLatest(PRODUCT_ID);
    expect(res).toEqual({
      success: true,
      message: 'Latest HPP calculation retrieved successfully',
      data: MOCK_SAVED,
    });
  });
});

import type {
  MaterialCategory,
  MaterialUnit,
  ProductCategory,
  ProductStatus,
  StockStatus,
} from '../../../generated/prisma/enums.js';
import type {
  MaterialModel,
  ProductModel,
  RecipeItemModel,
  RecipeModel,
} from '../../../generated/prisma/models.js';
import type {
  ApiResponse,
  PaginationMeta,
} from '../../materials/entities/material.entity.js';

export type { ApiResponse, PaginationMeta };

export interface RecipeProductSummary {
  id: string;
  code: string;
  name: string;
  category: ProductCategory;
  sellingPrice: number | null;
  status: ProductStatus;
  isActive: boolean;
}

export interface RecipeMaterialSummary {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  purchasePrice: number;
  stock: number;
  stockStatus: StockStatus;
  isLowStock: boolean;
}

export interface RecipeItemEntity {
  id: string;
  recipeId: string;
  materialId: string;
  quantity: number;
  unit: MaterialUnit;
  baseQuantity: number;
  baseUnit: MaterialUnit;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  material: RecipeMaterialSummary;
}

export interface RecipeEntity {
  id: string;
  productId: string;
  name: string | null;
  notes: string | null;
  yieldQuantity: number;
  yieldUnit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: RecipeProductSummary;
  items: RecipeItemEntity[];
}

export type RecipeItemWithMaterial = RecipeItemModel & {
  material: MaterialModel;
};

export type RecipeWithRelations = RecipeModel & {
  product: ProductModel;
  items: RecipeItemWithMaterial[];
};

export function mapRecipeItemEntity(
  item: RecipeItemWithMaterial,
): RecipeItemEntity {
  return {
    id: item.id,
    recipeId: item.recipeId,
    materialId: item.materialId,
    quantity: Number(item.quantity),
    unit: item.unit,
    baseQuantity: Number(item.baseQuantity),
    baseUnit: item.baseUnit,
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    material: {
      id: item.material.id,
      code: item.material.code,
      name: item.material.name,
      category: item.material.category,
      unit: item.material.unit,
      purchasePrice: Number(item.material.purchasePrice),
      stock: Number(item.material.stock),
      stockStatus: item.material.stockStatus,
      isLowStock: item.material.isLowStock,
    },
  };
}

export function mapRecipeEntity(recipe: RecipeWithRelations): RecipeEntity {
  return {
    id: recipe.id,
    productId: recipe.productId,
    name: recipe.name,
    notes: recipe.notes,
    yieldQuantity: Number(recipe.yieldQuantity),
    yieldUnit: recipe.yieldUnit,
    isActive: recipe.isActive,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    product: {
      id: recipe.product.id,
      code: recipe.product.code,
      name: recipe.product.name,
      category: recipe.product.category,
      sellingPrice:
        recipe.product.sellingPrice !== null
          ? Number(recipe.product.sellingPrice)
          : null,
      status: recipe.product.status,
      isActive: recipe.product.isActive,
    },
    items: recipe.items.map(mapRecipeItemEntity),
  };
}

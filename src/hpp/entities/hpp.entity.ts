import type {
  AdditionalCostCategory,
  MaterialCategory,
  MaterialUnit,
  ProductCategory,
} from '../../../generated/prisma/enums.js';
import type {
  HppAdditionalCostModel,
  HppCalculationModel,
  HppMaterialSnapshotModel,
} from '../../../generated/prisma/models.js';
import type {
  ApiResponse,
  PaginationMeta,
} from '../../materials/entities/material.entity.js';

export type { ApiResponse, PaginationMeta };

export const HPP_ROUNDING_RULE = 'ROUND_HALF_UP_2';

export interface HppMaterialSnapshotEntity {
  id?: string;
  hppCalculationId?: string;
  materialId: string | null;
  materialCode: string;
  materialName: string;
  materialCategory: MaterialCategory;
  usageQuantity: number;
  usageUnit: MaterialUnit;
  baseQuantity: number;
  baseUnit: MaterialUnit;
  unitPrice: number;
  subtotalCost: number;
  notes: string | null;
  createdAt?: Date;
}

export interface HppAdditionalCostEntity {
  id?: string;
  hppCalculationId?: string;
  category: AdditionalCostCategory;
  name: string;
  amount: number;
  notes: string | null;
  createdAt?: Date;
}

export interface HppPreviewEntity {
  isSaved: false;
  productId: string;
  recipeId: string;
  productCode: string;
  productName: string;
  productCategory: ProductCategory;
  productSellingPrice: number | null;
  recipeName: string | null;
  recipeYieldQuantity: number;
  recipeYieldUnit: string;
  productionQuantity: number;
  totalMaterialCost: number;
  totalAdditionalCost: number;
  totalHpp: number;
  hppPerUnit: number;
  roundingRule: string;
  notes: string | null;
  calculatedAt: Date;
  materialSnapshots: HppMaterialSnapshotEntity[];
  additionalCosts: HppAdditionalCostEntity[];
}

export interface HppCalculationEntity {
  id: string;
  isSaved: true;
  productId: string;
  recipeId: string;
  productCode: string;
  productName: string;
  productCategory: ProductCategory;
  productSellingPrice: number | null;
  recipeName: string | null;
  recipeYieldQuantity: number;
  recipeYieldUnit: string;
  productionQuantity: number;
  totalMaterialCost: number;
  totalAdditionalCost: number;
  totalHpp: number;
  hppPerUnit: number;
  roundingRule: string;
  notes: string | null;
  calculatedAt: Date;
  createdAt: Date;
  materialSnapshots: HppMaterialSnapshotEntity[];
  additionalCosts: HppAdditionalCostEntity[];
}

export type HppCalculationWithRelations = HppCalculationModel & {
  materialSnapshots: HppMaterialSnapshotModel[];
  additionalCosts: HppAdditionalCostModel[];
};

export function mapHppMaterialSnapshotEntity(
  snapshot: HppMaterialSnapshotModel,
): HppMaterialSnapshotEntity {
  return {
    id: snapshot.id,
    hppCalculationId: snapshot.hppCalculationId,
    materialId: snapshot.materialId,
    materialCode: snapshot.materialCode,
    materialName: snapshot.materialName,
    materialCategory: snapshot.materialCategory,
    usageQuantity: Number(snapshot.usageQuantity),
    usageUnit: snapshot.usageUnit,
    baseQuantity: Number(snapshot.baseQuantity),
    baseUnit: snapshot.baseUnit,
    unitPrice: Number(snapshot.unitPrice),
    subtotalCost: Number(snapshot.subtotalCost),
    notes: snapshot.notes,
    createdAt: snapshot.createdAt,
  };
}

export function mapHppAdditionalCostEntity(
  cost: HppAdditionalCostModel,
): HppAdditionalCostEntity {
  return {
    id: cost.id,
    hppCalculationId: cost.hppCalculationId,
    category: cost.category,
    name: cost.name,
    amount: Number(cost.amount),
    notes: cost.notes,
    createdAt: cost.createdAt,
  };
}

export function mapHppCalculationEntity(
  calculation: HppCalculationWithRelations,
): HppCalculationEntity {
  return {
    id: calculation.id,
    isSaved: true,
    productId: calculation.productId,
    recipeId: calculation.recipeId,
    productCode: calculation.productCode,
    productName: calculation.productName,
    productCategory: calculation.productCategory,
    productSellingPrice:
      calculation.productSellingPrice !== null
        ? Number(calculation.productSellingPrice)
        : null,
    recipeName: calculation.recipeName,
    recipeYieldQuantity: Number(calculation.recipeYieldQuantity),
    recipeYieldUnit: calculation.recipeYieldUnit,
    productionQuantity: Number(calculation.productionQuantity),
    totalMaterialCost: Number(calculation.totalMaterialCost),
    totalAdditionalCost: Number(calculation.totalAdditionalCost),
    totalHpp: Number(calculation.totalHpp),
    hppPerUnit: Number(calculation.hppPerUnit),
    roundingRule: calculation.roundingRule,
    notes: calculation.notes,
    calculatedAt: calculation.calculatedAt,
    createdAt: calculation.createdAt,
    materialSnapshots: calculation.materialSnapshots.map(
      mapHppMaterialSnapshotEntity,
    ),
    additionalCosts: calculation.additionalCosts.map(
      mapHppAdditionalCostEntity,
    ),
  };
}

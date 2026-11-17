import type {
  MaterialCategory,
  MaterialUnit,
  StockMovementType,
  StockStatus,
} from '../../../generated/prisma/enums.js';
import type {
  MaterialModel,
  StockMovementModel,
} from '../../../generated/prisma/models.js';

export interface MaterialEntity {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  purchasePrice: number;
  stock: number;
  minStock: number;
  stockStatus: StockStatus;
  isLowStock: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovementEntity {
  id: string;
  materialId: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitPrice: number | null;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export function mapMaterialEntity(material: MaterialModel): MaterialEntity {
  return {
    id: material.id,
    code: material.code,
    name: material.name,
    category: material.category,
    unit: material.unit,
    purchasePrice: Number(material.purchasePrice),
    stock: Number(material.stock),
    minStock: Number(material.minStock),
    stockStatus: material.stockStatus,
    isLowStock: material.isLowStock,
    description: material.description,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

export function mapStockMovementEntity(
  movement: StockMovementModel,
): StockMovementEntity {
  return {
    id: movement.id,
    materialId: movement.materialId,
    type: movement.type,
    quantity: Number(movement.quantity),
    previousStock: Number(movement.previousStock),
    newStock: Number(movement.newStock),
    unitPrice: movement.unitPrice !== null ? Number(movement.unitPrice) : null,
    reference: movement.reference,
    notes: movement.notes,
    createdAt: movement.createdAt,
  };
}

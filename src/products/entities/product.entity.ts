import type {
  ProductCategory,
  ProductStatus,
} from '../../../generated/prisma/enums.js';
import type { ProductModel } from '../../../generated/prisma/models.js';
import type {
  ApiResponse,
  PaginationMeta,
} from '../../materials/entities/material.entity.js';

export type { ApiResponse, PaginationMeta };

export interface ProductEntity {
  id: string;
  code: string;
  name: string;
  category: ProductCategory;
  description: string | null;
  sellingPrice: number | null;
  status: ProductStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function mapProductEntity(product: ProductModel): ProductEntity {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    category: product.category,
    description: product.description,
    sellingPrice:
      product.sellingPrice !== null ? Number(product.sellingPrice) : null,
    status: product.status,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

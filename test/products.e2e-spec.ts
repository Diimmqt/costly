import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { ProductCategory, ProductStatus } from '../generated/prisma/enums.js';
import type { ProductModel } from '../generated/prisma/models.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Products API (e2e)', () => {
  let app: INestApplication<App>;
  const productsStore = new Map<string, ProductModel>();
  const protectedProductIds = new Set<string>();

  const mockPrisma = {
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
    product: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            code: string;
            name: string;
            category: ProductCategory;
            description: string | null;
            sellingPrice: Prisma.Decimal | null;
            status: ProductStatus;
            isActive: boolean;
          };
        }) => {
          for (const existing of productsStore.values()) {
            if (existing.code === data.code) {
              throw { code: 'P2002', message: 'Unique constraint failed' };
            }
          }
          const now = new Date();
          const created: ProductModel = {
            id: crypto.randomUUID(),
            code: data.code,
            name: data.name,
            category: data.category,
            description: data.description,
            sellingPrice: data.sellingPrice,
            status: data.status,
            isActive: data.isActive,
            createdAt: now,
            updatedAt: now,
          };
          productsStore.set(created.id, created);
          return created;
        },
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return productsStore.get(where.id) ?? null;
      }),
      findMany: vi.fn(
        async ({
          where,
          skip = 0,
          take = 10,
        }: {
          where?: Record<string, any>;
          skip?: number;
          take?: number;
        }) => {
          let list = Array.from(productsStore.values());
          if (where?.category) {
            list = list.filter((p) => p.category === where.category);
          }
          if (where?.status) {
            list = list.filter((p) => p.status === where.status);
          }
          if (typeof where?.isActive === 'boolean') {
            list = list.filter((p) => p.isActive === where.isActive);
          }
          if (where?.OR) {
            const q = String(where.OR[0].name.contains).toLowerCase();
            list = list.filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                p.code.toLowerCase().includes(q),
            );
          }
          return list.slice(skip, skip + take);
        },
      ),
      count: vi.fn(async ({ where }: { where?: Record<string, any> }) => {
        const filtered = await mockPrisma.product.findMany({
          where,
          skip: 0,
          take: 1000,
        });
        return filtered.length;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<ProductModel>;
        }) => {
          const existing = productsStore.get(where.id);
          if (!existing) throw { code: 'P2025' };
          if (data.code && data.code !== existing.code) {
            for (const other of productsStore.values()) {
              if (other.id !== where.id && other.code === data.code) {
                throw { code: 'P2002' };
              }
            }
          }
          const updated: ProductModel = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          productsStore.set(where.id, updated);
          return updated;
        },
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const existing = productsStore.get(where.id);
        if (!existing) throw { code: 'P2025' };
        if (protectedProductIds.has(where.id)) {
          throw {
            code: 'P2003',
            message: 'Foreign key constraint failed on the field',
          };
        }
        productsStore.delete(where.id);
        return existing;
      }),
    },
  };

  beforeEach(async () => {
    productsStore.clear();
    protectedProductIds.clear();

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

  it('should perform full product lifecycle: validation, create, duplicate check, search/filter/pagination, status toggle, relation-protected delete, and clean delete', async () => {
    // 1. Validation check (400 Bad Request on invalid payload)
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({
        code: '',
        name: '',
        category: 'INVALID_CATEGORY',
        sellingPrice: -10000,
      })
      .expect(400);

    // 2. Create Product (201 Created)
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({
        code: 'PRD-KOPI-01',
        name: 'Es Kopi Susu Gula Aren',
        category: ProductCategory.BEVERAGE,
        description: 'Minuman kopi susu signature',
        sellingPrice: 22000,
      })
      .expect(201);

    expect(createRes.body.success).toBe(true);
    const productId: string = createRes.body.data.id;
    expect(createRes.body.data.code).toBe('PRD-KOPI-01');
    expect(createRes.body.data.sellingPrice).toBe(22000);
    expect(createRes.body.data.status).toBe(ProductStatus.ACTIVE);
    expect(createRes.body.data.isActive).toBe(true);

    // 3. Duplicate Code (409 Conflict)
    await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({
        code: 'PRD-KOPI-01',
        name: 'Produk Duplikat',
        category: ProductCategory.BEVERAGE,
      })
      .expect(409);

    // 4. Search & Filter & Pagination
    const listRes = await request(app.getHttpServer())
      .get(
        '/api/v1/products?search=Gula%20Aren&category=BEVERAGE&status=ACTIVE&page=1&limit=5',
      )
      .expect(200);

    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.meta.total).toBe(1);

    // 5. Update Product Details
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}`)
      .send({
        name: 'Es Kopi Susu Gula Aren Spesial',
        sellingPrice: 24000,
      })
      .expect(200);

    expect(patchRes.body.data.name).toBe('Es Kopi Susu Gula Aren Spesial');
    expect(patchRes.body.data.sellingPrice).toBe(24000);

    // 6. Toggle Status to INACTIVE via PATCH /products/:id/status
    const statusRes = await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}/status`)
      .send({
        status: ProductStatus.INACTIVE,
      })
      .expect(200);

    expect(statusRes.body.data.status).toBe(ProductStatus.INACTIVE);
    expect(statusRes.body.data.isActive).toBe(false);

    // 7. Reject invalid status value on PATCH /products/:id/status (400 Bad Request)
    await request(app.getHttpServer())
      .patch(`/api/v1/products/${productId}/status`)
      .send({
        status: 'INVALID_STATUS',
      })
      .expect(400);

    // 8. Prevent deleting product that has related HPP/transaction records (409 Conflict)
    protectedProductIds.add(productId);
    await request(app.getHttpServer())
      .delete(`/api/v1/products/${productId}`)
      .expect(409);

    // 9. Allow deleting product once no related records exist & verify 404 afterwards
    protectedProductIds.delete(productId);
    await request(app.getHttpServer())
      .delete(`/api/v1/products/${productId}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}`)
      .expect(404);
  });
});

import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  MaterialCategory,
  MaterialUnit,
  StockMovementType,
  StockStatus,
} from '../generated/prisma/enums.js';
import type {
  MaterialModel,
  StockMovementModel,
} from '../generated/prisma/models.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Materials API (e2e)', () => {
  let app: INestApplication<App>;
  const materialsStore = new Map<string, MaterialModel>();
  const movementsStore: StockMovementModel[] = [];

  const mockPrisma = {
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
    $transaction: vi.fn(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma),
    ),
    material: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            code: string;
            name: string;
            category: MaterialCategory;
            unit: MaterialUnit;
            purchasePrice: Prisma.Decimal;
            stock: Prisma.Decimal;
            minStock: Prisma.Decimal;
            stockStatus: StockStatus;
            isLowStock: boolean;
            description: string | null;
          };
        }) => {
          for (const existing of materialsStore.values()) {
            if (existing.code === data.code) {
              throw { code: 'P2002', message: 'Unique constraint failed' };
            }
          }
          const now = new Date();
          const created: MaterialModel = {
            id: crypto.randomUUID(),
            code: data.code,
            name: data.name,
            category: data.category,
            unit: data.unit,
            purchasePrice: data.purchasePrice,
            stock: data.stock,
            minStock: data.minStock,
            stockStatus: data.stockStatus,
            isLowStock: data.isLowStock,
            description: data.description,
            createdAt: now,
            updatedAt: now,
          };
          materialsStore.set(created.id, created);
          return created;
        },
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return materialsStore.get(where.id) ?? null;
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
          let list = Array.from(materialsStore.values());
          if (where?.category) {
            list = list.filter((m) => m.category === where.category);
          }
          if (where?.stockStatus) {
            list = list.filter((m) => m.stockStatus === where.stockStatus);
          }
          if (typeof where?.isLowStock === 'boolean') {
            list = list.filter((m) => m.isLowStock === where.isLowStock);
          }
          if (where?.OR) {
            const q = String(where.OR[0].name.contains).toLowerCase();
            list = list.filter(
              (m) =>
                m.name.toLowerCase().includes(q) ||
                m.code.toLowerCase().includes(q),
            );
          }
          return list.slice(skip, skip + take);
        },
      ),
      count: vi.fn(async ({ where }: { where?: Record<string, any> }) => {
        const filtered = await mockPrisma.material.findMany({
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
          data: Partial<MaterialModel>;
        }) => {
          const existing = materialsStore.get(where.id);
          if (!existing) throw { code: 'P2025' };
          if (data.code && data.code !== existing.code) {
            for (const other of materialsStore.values()) {
              if (other.id !== where.id && other.code === data.code) {
                throw { code: 'P2002' };
              }
            }
          }
          const updated: MaterialModel = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          materialsStore.set(where.id, updated);
          return updated;
        },
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const existing = materialsStore.get(where.id);
        if (!existing) throw { code: 'P2025' };
        materialsStore.delete(where.id);
        return existing;
      }),
    },
    stockMovement: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            materialId: string;
            type: StockMovementType;
            quantity: Prisma.Decimal;
            previousStock: Prisma.Decimal;
            newStock: Prisma.Decimal;
            unitPrice?: Prisma.Decimal | null;
            reference?: string | null;
            notes?: string | null;
          };
        }) => {
          const movement: StockMovementModel = {
            id: crypto.randomUUID(),
            materialId: data.materialId,
            type: data.type,
            quantity: data.quantity,
            previousStock: data.previousStock,
            newStock: data.newStock,
            unitPrice: data.unitPrice ?? null,
            reference: data.reference ?? null,
            notes: data.notes ?? null,
            createdAt: new Date(),
          };
          movementsStore.unshift(movement);
          return movement;
        },
      ),
      findMany: vi.fn(
        async ({
          where,
          skip = 0,
          take = 10,
        }: {
          where: { materialId: string; type?: StockMovementType };
          skip?: number;
          take?: number;
        }) => {
          let list = movementsStore.filter(
            (mv) => mv.materialId === where.materialId,
          );
          if (where.type) {
            list = list.filter((mv) => mv.type === where.type);
          }
          return list.slice(skip, skip + take);
        },
      ),
      count: vi.fn(
        async ({
          where,
        }: {
          where: { materialId: string; type?: StockMovementType };
        }) => {
          const list = await mockPrisma.stockMovement.findMany({
            where,
            skip: 0,
            take: 1000,
          });
          return list.length;
        },
      ),
    },
  };

  beforeEach(async () => {
    materialsStore.clear();
    movementsStore.length = 0;

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

  it('should perform full lifecycle: create, validate, duplicate check, search/filter, stock-in, stock-out, low-stock detection, history, and delete', async () => {
    // 1. Validation check (400 Bad Request on missing name/code or negative price)
    await request(app.getHttpServer())
      .post('/api/v1/materials')
      .send({
        code: '',
        name: '',
        category: 'INVALID_CATEGORY',
        unit: 'KILOGRAM',
        purchasePrice: -5000,
      })
      .expect(400);

    // 2. Create Material (201 Created)
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/materials')
      .send({
        code: 'BB-KOPI-01',
        name: 'Biji Kopi Arabika',
        category: MaterialCategory.MAIN,
        unit: MaterialUnit.KILOGRAM,
        purchasePrice: 120000,
        stock: 10,
        minStock: 5,
        description: 'Kopi Arabika Gayo',
      })
      .expect(201);

    expect(createRes.body.success).toBe(true);
    const materialId: string = createRes.body.data.id;
    expect(createRes.body.data.stock).toBe(10);
    expect(createRes.body.data.stockStatus).toBe(StockStatus.AVAILABLE);
    expect(createRes.body.data.isLowStock).toBe(false);

    // 3. Duplicate Code (409 Conflict)
    await request(app.getHttpServer())
      .post('/api/v1/materials')
      .send({
        code: 'BB-KOPI-01',
        name: 'Kopi Duplikat',
        category: MaterialCategory.MAIN,
        unit: MaterialUnit.KILOGRAM,
        purchasePrice: 100000,
      })
      .expect(409);

    // 4. Stock Out to reach minStock (10 - 5 = 5 -> LOW_STOCK, isLowStock=true)
    const stockOutRes = await request(app.getHttpServer())
      .post(`/api/v1/materials/${materialId}/stock-out`)
      .send({
        quantity: 5,
        reference: 'PROD-BATCH-01',
        notes: 'Roasting batch pagi',
      })
      .expect(200);

    expect(stockOutRes.body.data.material.stock).toBe(5);
    expect(stockOutRes.body.data.material.stockStatus).toBe(
      StockStatus.LOW_STOCK,
    );
    expect(stockOutRes.body.data.material.isLowStock).toBe(true);

    // 5. Reject Stock Out exceeding available stock (5 available, requesting 10 -> 400 Bad Request)
    await request(app.getHttpServer())
      .post(`/api/v1/materials/${materialId}/stock-out`)
      .send({
        quantity: 10,
      })
      .expect(400);

    // 6. Stock In (5 + 8 = 13 -> AVAILABLE, isLowStock=false)
    const stockInRes = await request(app.getHttpServer())
      .post(`/api/v1/materials/${materialId}/stock-in`)
      .send({
        quantity: 8,
        unitPrice: 125000,
        reference: 'PO-2026-10',
        notes: 'Restock supplier',
      })
      .expect(200);

    expect(stockInRes.body.data.material.stock).toBe(13);
    expect(stockInRes.body.data.material.purchasePrice).toBe(125000);
    expect(stockInRes.body.data.material.stockStatus).toBe(
      StockStatus.AVAILABLE,
    );
    expect(stockInRes.body.data.material.isLowStock).toBe(false);

    // 7. Get Stock History (INITIAL + OUT + IN = 3 records)
    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/materials/${materialId}/stock-history?page=1&limit=10`)
      .expect(200);

    expect(historyRes.body.data.movements).toHaveLength(3);
    expect(historyRes.body.meta.total).toBe(3);

    // 8. Search & Filter & Pagination
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/materials?search=Arabika&category=MAIN&page=1&limit=5')
      .expect(200);

    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.meta.total).toBe(1);

    // 9. Update Material
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/materials/${materialId}`)
      .send({
        name: 'Biji Kopi Arabika Spesial',
      })
      .expect(200);

    expect(patchRes.body.data.name).toBe('Biji Kopi Arabika Spesial');

    // 10. Delete Material & Verify 404 Afterwards
    await request(app.getHttpServer())
      .delete(`/api/v1/materials/${materialId}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/materials/${materialId}`)
      .expect(404);
  });
});

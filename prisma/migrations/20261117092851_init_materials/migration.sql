-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('MAIN', 'SUPPORTING', 'PACKAGING', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialUnit" AS ENUM ('GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'PIECE', 'PCS', 'SHEET', 'BOTTLE');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('INITIAL', 'IN', 'OUT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "unit" "MaterialUnit" NOT NULL,
    "purchase_price" DECIMAL(15,2) NOT NULL,
    "stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "stock_status" "StockStatus" NOT NULL DEFAULT 'OUT_OF_STOCK',
    "is_low_stock" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "previous_stock" DECIMAL(15,3) NOT NULL,
    "new_stock" DECIMAL(15,3) NOT NULL,
    "unit_price" DECIMAL(15,2),
    "reference" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversions" (
    "id" UUID NOT NULL,
    "from_unit" "MaterialUnit" NOT NULL,
    "to_unit" "MaterialUnit" NOT NULL,
    "factor" DECIMAL(18,6) NOT NULL,
    "material_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materials_code_key" ON "materials"("code");

-- CreateIndex
CREATE INDEX "materials_name_idx" ON "materials"("name");

-- CreateIndex
CREATE INDEX "materials_category_idx" ON "materials"("category");

-- CreateIndex
CREATE INDEX "materials_stock_status_idx" ON "materials"("stock_status");

-- CreateIndex
CREATE INDEX "materials_is_low_stock_idx" ON "materials"("is_low_stock");

-- CreateIndex
CREATE INDEX "stock_movements_material_id_created_at_idx" ON "stock_movements"("material_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");

-- CreateIndex
CREATE INDEX "unit_conversions_material_id_idx" ON "unit_conversions"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_conversions_from_unit_to_unit_material_id_key" ON "unit_conversions"("from_unit", "to_unit", "material_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

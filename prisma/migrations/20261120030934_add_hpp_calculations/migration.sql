-- CreateEnum
CREATE TYPE "AdditionalCostCategory" AS ENUM ('LABOR', 'ELECTRICITY', 'GAS', 'WATER', 'OPERATIONAL', 'OTHER');

-- CreateTable
CREATE TABLE "hpp_calculations" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "product_code" VARCHAR(50) NOT NULL,
    "product_name" VARCHAR(150) NOT NULL,
    "product_category" "ProductCategory" NOT NULL,
    "product_selling_price" DECIMAL(15,2),
    "recipe_name" VARCHAR(150),
    "recipe_yield_quantity" DECIMAL(15,3) NOT NULL,
    "recipe_yield_unit" VARCHAR(50) NOT NULL,
    "production_quantity" DECIMAL(15,3) NOT NULL,
    "total_material_cost" DECIMAL(15,2) NOT NULL,
    "total_additional_cost" DECIMAL(15,2) NOT NULL,
    "total_hpp" DECIMAL(15,2) NOT NULL,
    "hpp_per_unit" DECIMAL(15,2) NOT NULL,
    "rounding_rule" VARCHAR(50) NOT NULL DEFAULT 'ROUND_HALF_UP_2',
    "notes" TEXT,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hpp_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hpp_material_snapshots" (
    "id" UUID NOT NULL,
    "hpp_calculation_id" UUID NOT NULL,
    "material_id" UUID,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(150) NOT NULL,
    "material_category" "MaterialCategory" NOT NULL,
    "usage_quantity" DECIMAL(15,3) NOT NULL,
    "usage_unit" "MaterialUnit" NOT NULL,
    "base_quantity" DECIMAL(18,6) NOT NULL,
    "base_unit" "MaterialUnit" NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "subtotal_cost" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hpp_material_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hpp_additional_costs" (
    "id" UUID NOT NULL,
    "hpp_calculation_id" UUID NOT NULL,
    "category" "AdditionalCostCategory" NOT NULL DEFAULT 'OTHER',
    "name" VARCHAR(150) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hpp_additional_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hpp_calculations_product_id_calculated_at_idx" ON "hpp_calculations"("product_id", "calculated_at" DESC);

-- CreateIndex
CREATE INDEX "hpp_calculations_recipe_id_idx" ON "hpp_calculations"("recipe_id");

-- CreateIndex
CREATE INDEX "hpp_calculations_calculated_at_idx" ON "hpp_calculations"("calculated_at" DESC);

-- CreateIndex
CREATE INDEX "hpp_material_snapshots_hpp_calculation_id_idx" ON "hpp_material_snapshots"("hpp_calculation_id");

-- CreateIndex
CREATE INDEX "hpp_material_snapshots_material_id_idx" ON "hpp_material_snapshots"("material_id");

-- CreateIndex
CREATE INDEX "hpp_additional_costs_hpp_calculation_id_idx" ON "hpp_additional_costs"("hpp_calculation_id");

-- CreateIndex
CREATE INDEX "hpp_additional_costs_category_idx" ON "hpp_additional_costs"("category");

-- AddForeignKey
ALTER TABLE "hpp_calculations" ADD CONSTRAINT "hpp_calculations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hpp_calculations" ADD CONSTRAINT "hpp_calculations_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hpp_material_snapshots" ADD CONSTRAINT "hpp_material_snapshots_hpp_calculation_id_fkey" FOREIGN KEY ("hpp_calculation_id") REFERENCES "hpp_calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hpp_material_snapshots" ADD CONSTRAINT "hpp_material_snapshots_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hpp_additional_costs" ADD CONSTRAINT "hpp_additional_costs_hpp_calculation_id_fkey" FOREIGN KEY ("hpp_calculation_id") REFERENCES "hpp_calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

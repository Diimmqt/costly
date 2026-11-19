-- AlterEnum
ALTER TYPE "MaterialUnit" ADD VALUE 'DOZEN';

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" VARCHAR(150),
    "notes" TEXT,
    "yield_quantity" DECIMAL(15,3) NOT NULL DEFAULT 1,
    "yield_unit" VARCHAR(50) NOT NULL DEFAULT 'portion',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unit" "MaterialUnit" NOT NULL,
    "base_quantity" DECIMAL(18,6) NOT NULL,
    "base_unit" "MaterialUnit" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipes_product_id_key" ON "recipes"("product_id");

-- CreateIndex
CREATE INDEX "recipes_is_active_idx" ON "recipes"("is_active");

-- CreateIndex
CREATE INDEX "recipe_items_recipe_id_idx" ON "recipe_items"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_items_material_id_idx" ON "recipe_items"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_items_recipe_id_material_id_key" ON "recipe_items"("recipe_id", "material_id");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "OptionType" AS ENUM ('COLOR', 'SIZE');

-- CreateTable
CREATE TABLE "option_values" (
    "id" UUID NOT NULL,
    "type" "OptionType" NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "option_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "option_values_type_position_idx" ON "option_values"("type", "position");

-- CreateIndex
CREATE UNIQUE INDEX "option_values_type_code_key" ON "option_values"("type", "code");

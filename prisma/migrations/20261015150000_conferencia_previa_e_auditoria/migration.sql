-- CreateEnum
CREATE TYPE "TipoRegistroConferencia" AS ENUM ('COBERTURA', 'OCORRENCIA');

-- CreateEnum
CREATE TYPE "StatusConferenciaPosto" AS ENUM ('COBERTO', 'DESCOBERTO', 'PENDENTE');

-- CreateTable
CREATE TABLE "conferencia_previa" (
    "id" UUID NOT NULL,
    "tipo_registro" "TipoRegistroConferencia" NOT NULL,
    "registro_id" VARCHAR(255) NOT NULL,
    "competencia" VARCHAR(10),
    "previa_numero" INTEGER NOT NULL,
    "status" "StatusConferenciaPosto" NOT NULL,
    "comentario" TEXT,
    "registrado_por" TEXT,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conferencia_previa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_conferencia_registro" ON "conferencia_previa"("registro_id", "tipo_registro");

-- CreateIndex
CREATE INDEX "idx_conferencia_competencia_previa" ON "conferencia_previa"("competencia", "previa_numero");

-- CreateIndex
CREATE INDEX "idx_conferencia_data" ON "conferencia_previa"("registrado_em");

-- Auditoria em cobertura
ALTER TABLE "cobertura" RENAME COLUMN "created_at" TO "criado_em";
ALTER TABLE "cobertura" RENAME COLUMN "created_by" TO "criado_por";
ALTER TABLE "cobertura" RENAME COLUMN "updated_at" TO "atualizado_em";
ALTER TABLE "cobertura" RENAME COLUMN "updated_by" TO "atualizado_por";

-- Auditoria em ocorrencia
ALTER TABLE "ocorrencia" RENAME COLUMN "created_at" TO "criado_em";
ALTER TABLE "ocorrencia" RENAME COLUMN "created_by" TO "criado_por";
ALTER TABLE "ocorrencia" RENAME COLUMN "updated_at" TO "atualizado_em";
ALTER TABLE "ocorrencia" RENAME COLUMN "updated_by" TO "atualizado_por";

-- Auditoria em apontamento
ALTER TABLE "apontamento" RENAME COLUMN "created_at" TO "criado_em";
ALTER TABLE "apontamento" RENAME COLUMN "updated_at" TO "atualizado_em";
ALTER TABLE "apontamento" ADD COLUMN IF NOT EXISTS "atualizado_por" TEXT;

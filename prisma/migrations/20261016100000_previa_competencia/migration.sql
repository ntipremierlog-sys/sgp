-- CreateTable
CREATE TABLE "previa_competencia" (
    "id" UUID NOT NULL,
    "competencia" VARCHAR(7) NOT NULL,
    "numero" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "ajustada_manual" BOOLEAN NOT NULL DEFAULT false,
    "motivo_ajuste" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "atualizado_por" TEXT,

    CONSTRAINT "previa_competencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_previa_datas" ON "previa_competencia"("data_inicio", "data_fim");

-- CreateIndex
CREATE UNIQUE INDEX "previa_competencia_competencia_numero_key" ON "previa_competencia"("competencia", "numero");

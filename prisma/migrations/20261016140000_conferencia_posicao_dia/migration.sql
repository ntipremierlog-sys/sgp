-- Conferência por prévia (posição-dia), justificativa Premier e parecer PARCIAL.
-- Somente acréscimos: nenhum dado existente é alterado ou removido.

-- 1. Novos valores de enum
ALTER TYPE "TipoRegistroConferencia" ADD VALUE IF NOT EXISTS 'POSICAO_DIA';
ALTER TYPE "StatusConferenciaPosto" ADD VALUE IF NOT EXISTS 'PARCIAL';

-- 2. Colunas novas em conferencia_previa (todas opcionais)
ALTER TABLE "conferencia_previa"
    ADD COLUMN "posicao_id" VARCHAR(80),
    ADD COLUMN "data_referencia" DATE,
    ADD COLUMN "ocorrencia_id" VARCHAR(80),
    ADD COLUMN "cobertura_id" VARCHAR(80),
    ADD COLUMN "horas_descobertas" DECIMAL(5,2);

CREATE INDEX "idx_conferencia_posicao_dia" ON "conferencia_previa"("posicao_id", "data_referencia");

-- 3. Justificativa da Premier por posição-dia (somente inclusão)
CREATE TABLE "justificativa_premier" (
    "id" UUID NOT NULL,
    "posicao_id" VARCHAR(80) NOT NULL,
    "data" DATE NOT NULL,
    "competencia" VARCHAR(10) NOT NULL,
    "previa_numero" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "registrado_por" TEXT,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "justificativa_premier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_justificativa_competencia_previa" ON "justificativa_premier"("competencia", "previa_numero");
CREATE INDEX "idx_justificativa_posicao_dia" ON "justificativa_premier"("posicao_id", "data");

-- CreateTable
CREATE TABLE "marcacao_ponto" (
    "id" VARCHAR(120) NOT NULL,
    "lote_id" VARCHAR(100) NOT NULL,
    "arquivo_origem" VARCHAR(255),
    "colaborador_id" VARCHAR(100),
    "chapa" VARCHAR(20) NOT NULL,
    "cpf_limpo" VARCHAR(14),
    "data_hora_utc" TIMESTAMP(3),
    "data_local" VARCHAR(10) NOT NULL,
    "hora_local" VARCHAR(10) NOT NULL,
    "nsr" VARCHAR(50),
    "equipamento_origem" VARCHAR(255),
    "importado_em" TIMESTAMP(3),

    CONSTRAINT "marcacao_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_marcacao_chapa_data" ON "marcacao_ponto"("chapa", "data_local");

-- CreateIndex
CREATE INDEX "idx_marcacao_data_local" ON "marcacao_ponto"("data_local");

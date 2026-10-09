-- Etapa 5 — Alertas contratuais
-- Campos de gestão contratual no cadastro de ausências (ET 9.4.1 / ET 9.4.2)
ALTER TABLE "ocorrencia" ADD COLUMN "data_consulta_petrobras" DATE;
ALTER TABLE "ocorrencia" ADD COLUMN "substituicao_aprovada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ocorrencia" ADD COLUMN "substituto_chapa" TEXT;

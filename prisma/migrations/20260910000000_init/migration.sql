-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('PETROBRAS_FISCAL', 'PETROBRAS_GESTOR', 'PREMIER_ADMIN', 'PREMIER_GESTOR_CONTRATO', 'PREMIER_SUPERVISOR', 'PREMIER_RH', 'AUDITOR', 'PENDENTE_PERFIL');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'BLOQUEADO', 'REVOGADO', 'PENDENTE_PRIMEIRO_ACESSO');

-- CreateEnum
CREATE TYPE "SituacaoUnidade" AS ENUM ('ATIVA', 'INATIVA', 'SUSPENSA');

-- CreateTable
CREATE TABLE "contrato" (
    "id" UUID NOT NULL,
    "numero_icj" TEXT NOT NULL,
    "numero_sap" TEXT,
    "objeto" TEXT NOT NULL,
    "cliente" TEXT NOT NULL DEFAULT 'Petróleo Brasileiro S.A. - Petrobras',
    "vigencia_inicio" TIMESTAMP(3) NOT NULL,
    "vigencia_fim" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidade" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "municipio" TEXT NOT NULL,
    "centro_custo" TEXT,
    "gestor_premier" TEXT,
    "fiscal_petrobras" TEXT,
    "situacao" "SituacaoUnidade" NOT NULL DEFAULT 'ATIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'PENDENTE_PERFIL',
    "status" "StatusUsuario" NOT NULL DEFAULT 'PENDENTE_PRIMEIRO_ACESSO',
    "totp_segredo_cifrado" TEXT,
    "totp_ativado" BOOLEAN NOT NULL DEFAULT false,
    "tentativas_falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMP(3),
    "ultimo_acesso" TIMESTAMP(3),
    "empresa" TEXT NOT NULL DEFAULT 'Premier Logistics',
    "cargo" TEXT,
    "autorizado_por" TEXT,
    "data_concessao" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_unidade" (
    "usuario_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_unidade_pkey" PRIMARY KEY ("usuario_id","unidade_id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "ip" TEXT,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contrato_numero_icj_key" ON "contrato"("numero_icj");

-- CreateIndex
CREATE UNIQUE INDEX "unidade_codigo_key" ON "unidade"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- AddForeignKey
ALTER TABLE "unidade" ADD CONSTRAINT "unidade_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_unidade" ADD CONSTRAINT "usuario_unidade_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_unidade" ADD CONSTRAINT "usuario_unidade_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

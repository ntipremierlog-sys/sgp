-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatusImovel" AS ENUM ('ATIVO', 'INATIVO', 'EM_MOBILIZACAO', 'DESMOBILIZADO');

-- CreateEnum
CREATE TYPE "SituacaoPosto" AS ENUM ('ATIVO', 'SUSPENSO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "EscalaTrabalho" AS ENUM ('ESCALA_5X2', 'ESCALA_12X36', 'ESCALA_6X1', 'OUTRA');

-- CreateEnum
CREATE TYPE "SituacaoProfissional" AS ENUM ('ATIVO', 'AFASTADO', 'FERIAS', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "TipoAlocacao" AS ENUM ('TITULAR', 'SUBSTITUTO_FIXO');

-- CreateEnum
CREATE TYPE "GrupoOcorrencia" AS ENUM ('FERIAS', 'AFASTAMENTO_LEGAL', 'AUSENCIA_JUSTIFICADA', 'AUSENCIA_NAO_JUSTIFICADA', 'FOLGA_ESCALA', 'TREINAMENTO', 'SUSPENSAO', 'DESLIGAMENTO', 'OUTROS');

-- CreateEnum
CREATE TYPE "StatusOcorrencia" AS ENUM ('REGISTRADA', 'EM_VALIDACAO', 'VALIDADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "OrigemRegistro" AS ENUM ('MANUAL', 'IMPORTACAO');

-- CreateEnum
CREATE TYPE "TipoCobertura" AS ENUM ('SUBSTITUICAO_INTERNA', 'REMANEJAMENTO_ENTRE_POSTOS', 'HORA_EXTRA_TITULAR_OUTRO_POSTO', 'CONTRATACAO_TEMPORARIA', 'SEM_COBERTURA');

-- CreateEnum
CREATE TYPE "StatusCobertura" AS ENUM ('PLANEJADA', 'CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SituacaoPonto" AS ENUM ('PRESENTE', 'AUSENTE', 'FOLGA', 'FERIAS', 'AFASTADO', 'NAO_APLICAVEL');

-- CreateEnum
CREATE TYPE "StatusOcupacaoPosto" AS ENUM ('TITULAR_PRESENTE', 'COBERTO', 'DESCOBERTO', 'NAO_EXIGIVEL', 'POSTO_VAGO', 'PENDENTE_APURACAO');

-- CreateEnum
CREATE TYPE "VisibilidadeDocumento" AS ENUM ('PUBLICO_CONTRATANTE', 'RESTRITO_PREMIER', 'SENSIVEL');

-- CreateEnum
CREATE TYPE "StatusApontamento" AS ENUM ('ABERTO', 'EM_TRATAMENTO', 'RESPONDIDO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoImportacao" AS ENUM ('POSTOS_ANEXO_1A', 'PROFISSIONAIS', 'ALOCACOES', 'FREQUENCIA', 'OCORRENCIAS');

-- CreateEnum
CREATE TYPE "StatusImportacao" AS ENUM ('PROCESSANDO', 'CONCLUIDO', 'CONCLUIDO_COM_AVISOS', 'ERRO_CRITICO');

-- CreateEnum
CREATE TYPE "AbrangenciaFeriado" AS ENUM ('NACIONAL', 'ESTADUAL', 'MUNICIPAL');

-- CreateTable
CREATE TABLE "imovel" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "gerencia" TEXT NOT NULL,
    "preposto" TEXT,
    "status_imovel" "StatusImovel" NOT NULL DEFAULT 'ATIVO',
    "data_comunicacao_petrobras" DATE,
    "prazo_limite" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "imovel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_ppu" (
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "posicoes_por_posto" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_ppu_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "posto" (
    "id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "codigo_posto" TEXT NOT NULL,
    "posto_id_sgp" TEXT,
    "imovel_id" UUID,
    "item_ppu" TEXT,
    "regime" TEXT,
    "periculosidade" TEXT NOT NULL DEFAULT 'NÃO',
    "fator_medicao" DECIMAL(3,2) NOT NULL DEFAULT 0.8,
    "qtd_posicoes" INTEGER NOT NULL DEFAULT 1,
    "funcao" TEXT NOT NULL,
    "descricao" TEXT,
    "escala" "EscalaTrabalho" NOT NULL DEFAULT 'ESCALA_5X2',
    "jornada_semanal_horas" DECIMAL(5,2) NOT NULL,
    "horario_inicio" TEXT,
    "horario_fim" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "data_inicio_vigencia" TIMESTAMP(3) NOT NULL,
    "data_fim_vigencia" TIMESTAMP(3),
    "situacao" "SituacaoPosto" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "regime_posto_id" UUID,

    CONSTRAINT "posto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional" (
    "id" UUID NOT NULL,
    "matricula" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "data_nascimento" TIMESTAMP(3),
    "funcao" TEXT NOT NULL,
    "data_admissao" TIMESTAMP(3) NOT NULL,
    "data_desligamento" TIMESTAMP(3),
    "situacao" "SituacaoProfissional" NOT NULL DEFAULT 'ATIVO',
    "unidade_id" UUID NOT NULL,
    "telefone_corporativo" TEXT,
    "jornada_semanal_horas" DECIMAL(5,2),
    "escala_padrao" "EscalaTrabalho",
    "horario_inicio_padrao" TEXT,
    "horario_fim_padrao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional_dados_restritos" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "endereco" TEXT,
    "telefone_pessoal" TEXT,
    "email_pessoal" TEXT,
    "dados_bancarios" TEXT,
    "dependentes" TEXT,
    "salario" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profissional_dados_restritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alocacao" (
    "id" UUID NOT NULL,
    "posto_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "tipo" "TipoAlocacao" NOT NULL DEFAULT 'TITULAR',
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "motivo_movimentacao" TEXT,
    "documento_referencia" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "alocacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_ocorrencia" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao_interna" TEXT NOT NULL,
    "rotulo_publico" TEXT NOT NULL,
    "grupo" "GrupoOcorrencia" NOT NULL,
    "gera_dado_sensivel" BOOLEAN NOT NULL DEFAULT false,
    "exige_cobertura" BOOLEAN NOT NULL DEFAULT true,
    "impacta_medicao" BOOLEAN NOT NULL DEFAULT true,
    "exige_documento" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencia" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "posto_id" UUID,
    "tipo_ocorrencia_id" UUID NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "dias_uteis_afetados" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusOcorrencia" NOT NULL DEFAULT 'REGISTRADA',
    "origem" "OrigemRegistro" NOT NULL DEFAULT 'MANUAL',
    "registrado_por" TEXT,
    "observacao_publica" TEXT,
                "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencia_dado_sensivel" (
    "id" UUID NOT NULL,
    "ocorrencia_id" UUID NOT NULL,
    "cid" TEXT,
    "descricao_clinica" TEXT,
    "profissional_emissor" TEXT,
    "documento_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocorrencia_dado_sensivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobertura" (
    "id" UUID NOT NULL,
    "posto_id" UUID NOT NULL,
    "ocorrencia_id" UUID,
    "profissional_substituto_id" UUID NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "tipo_cobertura" "TipoCobertura" NOT NULL DEFAULT 'SUBSTITUICAO_INTERNA',
    "status" "StatusCobertura" NOT NULL DEFAULT 'CONFIRMADA',
    "justificativa" TEXT,
    "documento_referencia" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "posicao_id" UUID,

    CONSTRAINT "cobertura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frequencia_dia" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "posto_id" UUID,
    "situacao_ponto" "SituacaoPonto" NOT NULL DEFAULT 'PRESENTE',
    "hora_entrada" TEXT,
    "hora_saida" TEXT,
    "horas_trabalhadas" DECIMAL(5,2),
    "origem_importacao_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frequencia_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocupacao_posto_dia" (
    "id" UUID NOT NULL,
    "posto_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "titular_profissional_id" UUID,
    "ocupante_profissional_id" UUID,
    "status_ocupacao" "StatusOcupacaoPosto" NOT NULL,
    "ocorrencia_id" UUID,
    "cobertura_id" UUID,
    "motivo_publico" TEXT,
    "possui_evidencia" BOOLEAN NOT NULL DEFAULT false,
    "origem_dados" TEXT[],
    "conferido_por" TEXT,
    "conferido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocupacao_posto_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" UUID NOT NULL,
    "entidade_tipo" TEXT NOT NULL,
    "entidade_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "visibilidade" "VisibilidadeDocumento" NOT NULL DEFAULT 'RESTRITO_PREMIER',
    "enviado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apontamento" (
    "id" UUID NOT NULL,
    "posto_id" UUID,
    "ocupacao_posto_dia_id" UUID,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fim" TIMESTAMP(3) NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_por" TEXT NOT NULL,
    "status" "StatusApontamento" NOT NULL DEFAULT 'ABERTO',
    "resposta_premier" TEXT,
    "respondido_por" TEXT,
    "respondido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apontamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacao" (
    "id" UUID NOT NULL,
    "tipo" "TipoImportacao" NOT NULL,
    "arquivo_nome" TEXT NOT NULL,
    "hash_sha256" TEXT,
    "linhas_lidas" INTEGER NOT NULL DEFAULT 0,
    "linhas_ok" INTEGER NOT NULL DEFAULT 0,
    "linhas_erro" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusImportacao" NOT NULL DEFAULT 'PROCESSANDO',
    "log_json" JSONB,
    "usuario_id" UUID,
    "competencia" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriado" (
    "id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "nome" TEXT NOT NULL,
    "abrangencia" "AbrangenciaFeriado" NOT NULL DEFAULT 'NACIONAL',
    "uf" VARCHAR(2),
    "municipio" TEXT,
    "unidade_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_importacao" (
    "id" UUID NOT NULL,
    "fonte" TEXT NOT NULL,
    "data_execucao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fim" TIMESTAMP(3) NOT NULL,
    "registros_lidos" INTEGER NOT NULL,
    "registros_erro" INTEGER NOT NULL DEFAULT 0,
    "usuario_processo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONCLUIDO',
    "detalhes" TEXT,

    CONSTRAINT "log_importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametro_contrato" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "unidade_id" UUID,
    "meta_sla" DECIMAL(5,2) NOT NULL DEFAULT 95.0,
    "fator_glosa" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "vigencia_inicio" TIMESTAMP(3) NOT NULL,
    "vigencia_fim" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "parametro_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valor_posto_contrato" (
    "id" UUID NOT NULL,
    "posto_id" UUID NOT NULL,
    "valor_mensal" DECIMAL(12,2) NOT NULL,
    "vigencia_inicio" TIMESTAMP(3) NOT NULL,
    "vigencia_fim" TIMESTAMP(3),

    CONSTRAINT "valor_posto_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regime_posto" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade_posicoes" INTEGER NOT NULL,
    "regra_cadastro" TEXT NOT NULL,
    "observacoes" TEXT,
    "status_premissa" TEXT NOT NULL DEFAULT 'fechada',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regime_posto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posicao_posto" (
    "id" UUID NOT NULL,
    "posicao_id_sgp" TEXT NOT NULL,
    "posto_id" UUID NOT NULL,
    "codigo_estrutural" TEXT,
    "id_original_mc" TEXT,
    "sufixo" INTEGER NOT NULL,
    "chapa_titular" TEXT,
    "nome_titular" TEXT,
    "situacao_rm" TEXT,
    "escala_pendente" BOOLEAN NOT NULL DEFAULT false,
    "status_validacao" TEXT NOT NULL DEFAULT 'VALIDADA',
    "conflito_cadastro" TEXT,
    "eh_estrutural" BOOLEAN NOT NULL DEFAULT true,
    "horario_rm" TEXT,
    "escala_tipo" TEXT,
    "faixa_horaria" TEXT,
    "regime_dias" TEXT,
    "grupo_revezamento" TEXT,
    "data_base_escala" DATE,
    "fase_ciclo" TEXT,
    "fonte_escala" TEXT,
    "status_programacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posicao_posto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_titular_posicao" (
    "id" UUID NOT NULL,
    "posicao_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "motivo" TEXT,
    "observacoes" TEXT,

    CONSTRAINT "historico_titular_posicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ferista_posto" (
    "id" UUID NOT NULL,
    "posto_id" UUID NOT NULL,
    "chapa" TEXT,
    "nome" TEXT,
    "situacao_rm" TEXT,
    "profissional_id" UUID,
    "unidade_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMP(3),
    "observacoes" TEXT,

    CONSTRAINT "ferista_posto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_rm" (
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "jornada_padrao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horario_rm_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "secao_rm" (
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secao_rm_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "situacao_rm" (
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "situacao_rm_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "funcao_rm" (
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funcao_rm_pkey" PRIMARY KEY ("nome")
);

-- CreateTable
CREATE TABLE "funcionario_rm" (
    "chapa" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "funcao_nome" TEXT NOT NULL,
    "horario_codigo" TEXT NOT NULL,
    "secao_codigo" TEXT NOT NULL,
    "situacao_codigo" TEXT NOT NULL,
    "salario_mensal" DECIMAL(12,2) NOT NULL,
    "salario_hora" DECIMAL(12,2) NOT NULL,
    "data_admissao" DATE NOT NULL,
    "data_demissao" DATE,
    "data_nascimento" DATE NOT NULL,
    "sexo" VARCHAR(1) NOT NULL,
    "jornada" TEXT NOT NULL,
    "consta_ultima_carga" BOOLEAN NOT NULL DEFAULT true,
    "lote_ultima_carga_id" UUID,
    "data_ultima_carga" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funcionario_rm_pkey" PRIMARY KEY ("chapa")
);

-- CreateTable
CREATE TABLE "historico_funcionario_rm" (
    "id" UUID NOT NULL,
    "chapa" TEXT NOT NULL,
    "lote_carga_id" UUID NOT NULL,
    "data_vigencia" DATE NOT NULL,
    "tipo_alteracao" TEXT NOT NULL,
    "secao_codigo" TEXT,
    "horario_codigo" TEXT,
    "funcao_nome" TEXT,
    "situacao_codigo" TEXT,
    "valor_anterior" TEXT,
    "valor_novo" TEXT NOT NULL,
    "descricao_anterior" TEXT,
    "descricao_nova" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_funcionario_rm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote_carga_rm" (
    "id" UUID NOT NULL,
    "data_carga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_referencia" DATE NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "formato_arquivo" TEXT NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "total_linhas_lidas" INTEGER NOT NULL,
    "total_novos" INTEGER NOT NULL,
    "total_atualizados" INTEGER NOT NULL,
    "total_sem_alteracao" INTEGER NOT NULL,
    "total_nao_constam" INTEGER NOT NULL,
    "total_erros" INTEGER NOT NULL,
    "total_alertas" INTEGER NOT NULL,
    "divergencia_secao" BOOLEAN NOT NULL DEFAULT false,
    "chapas_nao_constantes" JSONB,
    "alertas_detalhes" JSONB,
    "erros_detalhes" JSONB,
    "usuario_processo" TEXT,

    CONSTRAINT "lote_carga_rm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imovel_nome_key" ON "imovel"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "posto_codigo_posto_key" ON "posto"("codigo_posto");

-- CreateIndex
CREATE UNIQUE INDEX "posto_posto_id_sgp_key" ON "posto"("posto_id_sgp");

-- CreateIndex
CREATE INDEX "idx_posto_imovel" ON "posto"("imovel_id");

-- CreateIndex
CREATE INDEX "idx_posto_item_ppu" ON "posto"("item_ppu");

-- CreateIndex
CREATE UNIQUE INDEX "profissional_matricula_key" ON "profissional"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "profissional_dados_restritos_profissional_id_key" ON "profissional_dados_restritos"("profissional_id");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_ocorrencia_codigo_key" ON "tipo_ocorrencia"("codigo");

-- CreateIndex
CREATE INDEX "idx_ocorrencia_datas" ON "ocorrencia"("data_inicio", "data_fim");

-- CreateIndex
CREATE INDEX "idx_ocorrencia_posto" ON "ocorrencia"("posto_id");

-- CreateIndex
CREATE INDEX "idx_ocorrencia_status" ON "ocorrencia"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ocorrencia_dado_sensivel_ocorrencia_id_key" ON "ocorrencia_dado_sensivel"("ocorrencia_id");

-- CreateIndex
CREATE INDEX "idx_cobertura_datas" ON "cobertura"("data_inicio", "data_fim");

-- CreateIndex
CREATE INDEX "idx_cobertura_posto" ON "cobertura"("posto_id");

-- CreateIndex
CREATE INDEX "idx_cobertura_status" ON "cobertura"("status");

-- CreateIndex
CREATE UNIQUE INDEX "frequencia_dia_profissional_id_data_key" ON "frequencia_dia"("profissional_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ocupacao_posto_dia_posto_id_data_key" ON "ocupacao_posto_dia"("posto_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "regime_posto_codigo_key" ON "regime_posto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "posicao_posto_posicao_id_sgp_key" ON "posicao_posto"("posicao_id_sgp");

-- CreateIndex
CREATE UNIQUE INDEX "funcionario_rm_cpf_key" ON "funcionario_rm"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "lote_carga_rm_hash_sha256_key" ON "lote_carga_rm"("hash_sha256");

-- AddForeignKey
ALTER TABLE "posto" ADD CONSTRAINT "posto_imovel_id_fkey" FOREIGN KEY ("imovel_id") REFERENCES "imovel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posto" ADD CONSTRAINT "posto_item_ppu_fkey" FOREIGN KEY ("item_ppu") REFERENCES "item_ppu"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posto" ADD CONSTRAINT "posto_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posto" ADD CONSTRAINT "posto_regime_posto_id_fkey" FOREIGN KEY ("regime_posto_id") REFERENCES "regime_posto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional" ADD CONSTRAINT "profissional_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional_dados_restritos" ADD CONSTRAINT "profissional_dados_restritos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_posto_id_fkey" FOREIGN KEY ("posto_id") REFERENCES "posto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_posto_id_fkey" FOREIGN KEY ("posto_id") REFERENCES "posto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_tipo_ocorrencia_id_fkey" FOREIGN KEY ("tipo_ocorrencia_id") REFERENCES "tipo_ocorrencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_dado_sensivel" ADD CONSTRAINT "ocorrencia_dado_sensivel_ocorrencia_id_fkey" FOREIGN KEY ("ocorrencia_id") REFERENCES "ocorrencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_dado_sensivel" ADD CONSTRAINT "ocorrencia_dado_sensivel_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura" ADD CONSTRAINT "cobertura_posto_id_fkey" FOREIGN KEY ("posto_id") REFERENCES "posto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura" ADD CONSTRAINT "cobertura_posicao_id_fkey" FOREIGN KEY ("posicao_id") REFERENCES "posicao_posto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura" ADD CONSTRAINT "cobertura_ocorrencia_id_fkey" FOREIGN KEY ("ocorrencia_id") REFERENCES "ocorrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura" ADD CONSTRAINT "cobertura_profissional_substituto_id_fkey" FOREIGN KEY ("profissional_substituto_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencia_dia" ADD CONSTRAINT "frequencia_dia_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencia_dia" ADD CONSTRAINT "frequencia_dia_posto_id_fkey" FOREIGN KEY ("posto_id") REFERENCES "posto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequencia_dia" ADD CONSTRAINT "frequencia_dia_origem_importacao_id_fkey" FOREIGN KEY ("origem_importacao_id") REFERENCES "importacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupacao_posto_dia" ADD CONSTRAINT "ocupacao_posto_dia_posto_id_fkey" FOREIGN KEY ("posto_id") REFERENCES "posto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupacao_posto_dia" ADD CONSTRAINT "ocupacao_posto_dia_titular_profissional_id_fkey" FOREIGN KEY ("titular_profissional_id") REFERENCES "profissional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupacao_posto_dia" ADD CONSTRAINT "ocupacao_posto_dia_ocupante_profissional_id_fkey" FOREIGN KEY ("ocupante_profissional_id") REFERENCES "profissional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupacao_posto_dia" ADD CONSTRAINT "ocupacao_posto_dia_ocorrencia_id_fkey" FOREIGN KEY ("ocorrencia_id") REFERENCES "ocorrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupacao_posto_dia" ADD CONSTRAINT "ocupacao_posto_dia_cobertura_id_fkey" FOREIGN KEY ("cobertura_id") REFERENCES "cobertura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apontamento" ADD CONSTRAINT "apontamento_posto_id_fkey" FOREIGN KEY ("posto_id") REFERENCES "posto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apontamento" ADD CONSTRAINT "apontamento_ocupacao_posto_dia_id_fkey" FOREIGN KEY ("ocupacao_posto_dia_id") REFERENCES "ocupacao_posto_dia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feriado" ADD CONSTRAINT "feriado_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posicao_posto" ADD CONSTRAINT "posicao_posto_posto_id_fkey" FOREIGN KEY ("posto_id") REFERENCES "posto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_titular_posicao" ADD CONSTRAINT "historico_titular_posicao_posicao_id_fkey" FOREIGN KEY ("posicao_id") REFERENCES "posicao_posto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_titular_posicao" ADD CONSTRAINT "historico_titular_posicao_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ferista_posto" ADD CONSTRAINT "ferista_posto_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ferista_posto" ADD CONSTRAINT "ferista_posto_posto_id_fkey" FOREIGN KEY ("posto_id") REFERENCES "posto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario_rm" ADD CONSTRAINT "funcionario_rm_funcao_nome_fkey" FOREIGN KEY ("funcao_nome") REFERENCES "funcao_rm"("nome") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario_rm" ADD CONSTRAINT "funcionario_rm_horario_codigo_fkey" FOREIGN KEY ("horario_codigo") REFERENCES "horario_rm"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario_rm" ADD CONSTRAINT "funcionario_rm_secao_codigo_fkey" FOREIGN KEY ("secao_codigo") REFERENCES "secao_rm"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario_rm" ADD CONSTRAINT "funcionario_rm_situacao_codigo_fkey" FOREIGN KEY ("situacao_codigo") REFERENCES "situacao_rm"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario_rm" ADD CONSTRAINT "funcionario_rm_lote_ultima_carga_id_fkey" FOREIGN KEY ("lote_ultima_carga_id") REFERENCES "lote_carga_rm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_funcionario_rm" ADD CONSTRAINT "historico_funcionario_rm_chapa_fkey" FOREIGN KEY ("chapa") REFERENCES "funcionario_rm"("chapa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_funcionario_rm" ADD CONSTRAINT "historico_funcionario_rm_lote_carga_id_fkey" FOREIGN KEY ("lote_carga_id") REFERENCES "lote_carga_rm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_funcionario_rm" ADD CONSTRAINT "historico_funcionario_rm_secao_codigo_fkey" FOREIGN KEY ("secao_codigo") REFERENCES "secao_rm"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_funcionario_rm" ADD CONSTRAINT "historico_funcionario_rm_horario_codigo_fkey" FOREIGN KEY ("horario_codigo") REFERENCES "horario_rm"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_funcionario_rm" ADD CONSTRAINT "historico_funcionario_rm_funcao_nome_fkey" FOREIGN KEY ("funcao_nome") REFERENCES "funcao_rm"("nome") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_funcionario_rm" ADD CONSTRAINT "historico_funcionario_rm_situacao_codigo_fkey" FOREIGN KEY ("situacao_codigo") REFERENCES "situacao_rm"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;
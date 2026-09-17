# Registro de Alterações (CHANGELOG) — SGP

Todas as alterações relevantes e entregas incrementais por semana de desenvolvimento estão registradas neste documento.

---

## [Entrega Oficial — MOMENTO 3: Importação do Cubo de Abono RM e Integração com Cálculo de Ocupação] — 17/09/2026

### O que ficou pronto:
- **Motor de Importação e Validação do Cubo de Abono RM (`src/lib/importadores/cubo-abono.ts`):**
  - Reconhecimento automático dos cabeçalhos do arquivo `CUBO DE ABONO.xlsx`.
  - Normalização de chapa com 6 dígitos (`037196`), correspondência com o RM e vinculação automática com o posto do titular (`postoCodigo`).
  - Categorização das 6 classes reais de abono/atestado da Petrobras: `ATESTADO_MEDICO`, `ABONO_LEGAL` (abono superior, doação de sangue, eleitoral) e `FALTA_JUSTIFICADA` (declaração de comparecimento, acompanhamento).
  - Sanitização estrita LGPD: observações públicas sem exposição de CID, CRM ou diagnóstico clínico.
  - Geração de relatório de validação XLSX com abas *Resumo*, *Ocorrências* e *Inconsistências*.
  - Geração de planilha modelo oficial do Cubo de Abono para download.
  - Suporte resiliente a hash criptográfico SHA-256 e detecção de arquivos duplicados.
- **Interface de Importações (`src/app/importacoes/page.tsx`):**
  - Identificação dinâmica de `ABONO_RM` com métricas detalhadas (lidos, novos, erros, alertas).
  - Download dinâmico dos modelos de planilha para Funcionários RM e Cubo de Abono.
  - Download do relatório de validação completo em formato XLSX.
  - Histórico de lotes com badge `Cubo Abono` e funcionalidade de rollback (desfazer lote) com restauração de snapshot.
- **Interface de Ocorrências (`src/app/ocorrencias/page.tsx`):**
  - Suporte visual ao tipo `ABONO_LEGAL` com badges em tom índigo/violeta no design system.
  - Filtro por competência mensal (`2026-08`, `2026-09` ou Todos os Meses).
  - Indicadores dinâmicos calculados a partir das ocorrências carregadas.
  - Segregação de acesso LGPD mantida (bloqueio a dados médicos para Fiscal Petrobras).
- **Testes Automatizados Vitest:**
  - Criação de `src/__tests__/importacao-cubo-abono-momento3.test.ts` com 9 testes automatizados cobrindo todos os cenários com planilhas sintéticas.
  - Total geral da suíte: **113 testes passando em 14 arquivos**, com zero erros de tipagem no TypeScript.

---

## [Entrega Oficial — MOMENTO 2: Importação Lista SIFAC e Conciliação RM × SIFAC] — 17/09/2026

### O que ficou pronto:
- **Importação da Lista de Alocados SIFAC (`src/lib/importadores/sifac-alocados.ts`):**
  - Leitura estrita da aba "Modelo", validação bloqueante de Contrato (4600682336) e CNPJ da Premier.
  - Filtro de colunas permitidas e descarte sumário de dados de seguro de vida e planos de saúde (LGPD).
  - Normalização de CPF para 11 dígitos com preenchimento de zeros à esquerda.
- **Conciliação Cadastral RM × SIFAC (`src/lib/dados/conciliacao-sifac.ts` e `/conciliacao-sifac`):**
  - Motor de cruzamento cobrindo os 12 tipos de divergência cadastral.
  - Tela exclusiva para o Administrador Premier com alternador de sigilo salarial e bloqueio de acesso ao Fiscal Petrobras.
  - Modal de tratamento de divergências com justificativa obrigatória e autoria.
  - Exportação de relatório XLSX com abas *Resumo* e *Divergências*.
  - 23 testes automatizados passando em `src/__tests__/conciliacao-sifac-momento2.test.ts`.

---

## [Entrega Oficial — MOMENTO 1: Limpeza de Demonstração e Importação RM] — 17/09/2026

### O que ficou pronto:
- Limpeza dos dados de demonstração com backup automático prévio e rastreabilidade na auditoria.
- Estrutura geral de importação por lotes com rollback atômico e retenção por 90 dias.
- Importação do cadastro de funcionários do RM com sexo, data de nascimento e cálculo dinâmico de idade.

---

### O que ficou pronto:
- **Modelagem Relacional Expandida no Prisma:**
  - Criação das entidades operacionais em `prisma/schema.prisma`: `Profissional`, `ProfissionalDadosRestritos` (dados não essenciais à fiscalização isolados), `Posto`, `Alocacao`, `TipoOcorrencia`, `Ocorrencia`, `OcorrenciaDadoSensivel` (segregação de CID/médico com bloqueio 403 à Petrobras), `Cobertura`, `FrequenciaDia`, `OcupacaoPostoDia`, `Documento` (bytea), `Importacao`, `Feriado` e `Apontamento`.
  - Regeneração do cliente tipado via `prisma generate`.
- **Dicionário Oficial de Campos e Schemas Zod:**
  - Criação de `src/lib/importadores/tipos.ts` com schemas Zod para Colaboradores, Ponto e Ocorrências.
  - Parsers para padrões brasileiros: datas `dd/mm/aaaa`, conversão de números decimais com vírgula (`44,0`) e sanitização/mascaramento de CPF (`***.456.789-**`).
- **Templates de Planilha para Download:**
  - `public/templates/modelo_colaboradores.csv`: Modelo para importação do quadro de colaboradores com jornada e local de trabalho.
  - `public/templates/modelo_ponto_frequencia.csv`: Modelo para importação de registros de frequência e batidas de ponto.
  - `public/templates/modelo_ocorrencias.csv`: Modelo para importação de atestados médicos, faltas e abonos.
- **Interface Interativa em `/importacoes`:**
  - Abas dinâmicas para Colaboradores, Ponto e Ocorrências.
  - Tabelas completas com dicionário de campos, tipos, obrigatoriedade e regras contratuais.
  - Botão de download direto do modelo CSV para cada tipo de planilha.
  - Simulador de pré-validação com relatório em verde de integridade de linhas.
  - Painel explicativo de como os arquivos alimentam a tabela central `ocupacao_posto_dia` e as 5 perguntas da Petrobras.
- **Testes Automatizados:**
  - Adicionados 6 testes em `src/__tests__/validacao-importacao.test.ts`. Total: **11 testes passando** no Vitest.

---

## [Semana 1] — 10/09/2026 a 16/09/2026

### O que ficou pronto:
- Fundação Next.js 15, TypeScript estrito, Tailwind CSS e layout corporativo institucional com cabeçalho fixo, menu lateral e rodapé LGPD.
- Docker Compose com PostgreSQL 16 Alpine e Prisma configurado para Neon em São Paulo (`aws-sa-east-1`).
- Matriz de Conformidade Contratual (`/conformidade`) com requisitos R1 a R5.
- Vitest, ESLint, Prettier e documentação inicial (`README.md`, `docs/DEPLOY.md`).

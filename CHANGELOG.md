# Registro de Alterações (CHANGELOG) — SGP

Todas as alterações relevantes e entregas incrementais por semana de desenvolvimento estão registradas neste documento.

---

## [Entrega Complementar — Módulo de Importações e Modelagem de Campos] — 10/09/2026

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

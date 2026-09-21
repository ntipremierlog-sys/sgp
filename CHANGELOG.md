# Registro de Alterações (CHANGELOG) — SGP

Todas as alterações relevantes e entregas incrementais por semana de desenvolvimento estão registradas neste documento.

---

## [Entrega Oficial — Fluxo de Fechamento de Competência & Congelamento Mensal (Item 11.3)] — 21/09/2026

### O que ficou pronto:
- **Fluxo de Fechamento de Competência & Congelamento Imutável (`src/lib/dados/estado-operacional.ts`):**
  - Implementação do ciclo de vida formal de competência: `ABERTO` $\rightarrow$ `CONGELADO`.
  - Geração de carimbo criptográfico SHA-256 no congelamento (`SGP-COMPETENCIA-YYYY-MM-sha256`), garantindo integridade e inviolabilidade dos dados de medição.
  - Registro de auditoria imutável com data/hora de congelamento, usuário responsável, total de diárias cumpridas/glosadas, SLA final e valor líquido referencial.
  - Suporte ao Atesto Formal da Fiscalização Petrobras (`homologarMedicaoPetrobras`) com registro de fiscal, matrícula Petrobras, data/hora e parecer técnico.
  - Fluxo de reabertura emergencial controlada (`reabrirCompetencia`) com justificativa obrigatória (> 10 caracteres) para governança e trilha de auditoria.
- **Interface Executiva de Fechamento (`src/app/fechamento/page.tsx`):**
  - Tela dedicada com KPIs executivos da competência selecionada (Status, SLA, Diárias Cumpridas vs Glosadas, Faturamento Líquido).
  - Modal interativo de congelamento com resumo dos dados e confirmação consciente.
  - Modal de homologação da Fiscalização Petrobras com coleta de dados de atesto.
  - Modal de reabertura emergencial com exigência de justificativa técnica auditável.
  - Histórico de competências com badges de status, hash SHA-256 e visualização rápida.
- **Proteção Contra Alterações Retroativas (`src/app/coberturas/page.tsx`):**
  - Verificação de competência congelada antes do envio de coberturas (`isCompetenciaCongelada`).
  - Bloqueio ativo no formulário com banner informativo em vermelho e link direto para a tela de fechamento.
- **Sinalização de Fechamento nos Relatórios e Navegação:**
  - Badge de status de competência nos Relatórios Oficiais (`src/app/relatorios/page.tsx`) indicando se os relatórios já estão oficialmente congelados ou ainda em apuração aberta.
  - Novo item de navegação `Fechamento mensal` no menu lateral (`src/components/layout/menu-lateral.tsx`) com ícone de cadeado (`Lock`).
- **Métricas de Qualidade & Testes:**
  - 6 novos testes automatizados em `src/__tests__/fechamento-competencia.test.ts` cobrindo o ciclo de vida completo, integridade do hash, bloqueio retroativo, atesto Petrobras e reabertura justificada.
  - Suíte geral de testes: **161 testes passando em 21 arquivos (100% de sucesso)**.
  - Verificação rigorosa de tipagem com TypeScript (`npx tsc --noEmit`) sem nenhum erro.

---

## [Entrega Oficial — Consolidação dos Relatórios & Memória de Cálculo Oficial (Item 11.3)] — 21/09/2026

### O que ficou pronto:
- **Relatórios Oficiais & Memória de Cálculo da Medição (`src/app/relatorios/page.tsx`):**
  - Implementação integral dos Requisitos R4 e R5 do **Item 11.3** do Contrato Petrobras ICJ 5900.0129796.25.2.
  - Suporte multi-base cobrindo todas as 29 bases operacionais através de `obterTodosPostosContrato()`.
  - Competência mensal dinâmica com cálculo automático de dias apurados e corte determinístico de dados de ponto.
  - **Nova Aba 1 — Memória de Cálculo & Faturamento:**
    - Painel executivo com Diárias Exigíveis, Diárias Cumpridas (Presente + Coberto), Diárias Glosadas (Descobertos) e SLA Contratual (Meta >= 95,0%).
    - Demonstrativo financeiro referencial de faturamento bruto, cálculo de glosas (30 avos por dia descoberto) e faturamento líquido estimado.
    - Consolidação sintética por base operacional comparando cumprimento com meta de SLA.
  - **Aba 2 — Espelho Mensal de Ocupação:** Visão analítica posto a posto detalhando presença, cobertura, postos vagos e taxa de entrega.
  - **Aba 3 — Demonstrativo de Glosas & Descobertos:** Detalhamento dia a dia das ausências injustificadas para respaldo de glosas na fatura da Petrobras.
  - **Aba 4 — Rastreabilidade de Coberturas & Interjornada:** Registro de substitutos com auditoria em tempo real de conformidade ao intervalo de 11h (Art. 66 da CLT e passivo de 50% conforme Súmula 110/TST).
- **Exportação XLSX Oficial Multi-Abas:**
  - Geração nativa de pasta de trabalho Excel (`.xlsx`) com 4 abas estruturadas (*1. Memória de Cálculo*, *2. Espelho de Ocupação*, *3. Glosas e Descobertos*, *4. Coberturas e Interjornada*).
  - Exportação de CSV por aba ativa e suporte a impressão executiva sem elementos visuais supérfluos (`window.print()`).
- **Autenticidade e Auditoria:**
  - Carimbo digital com chave de autenticidade SHA-256 e termos de assinatura formal para Gestor da Contratada e Fiscal Técnico Petrobras.
- **Métricas de Qualidade:**
  - 5 novos testes automatizados adicionados em `src/__tests__/relatorios-memoria-calculo.test.ts`.
  - Suíte geral de testes: **155 testes passando em 20 arquivos (100% de sucesso)**.
  - Compilação estática de produção verificada com zero erros.

---

## [Entrega Complementar — Interjornada CLT Art. 66, Dados Reais de Ponto e Redesenho Multi-Base] — 21/09/2026

### O que ficou pronto:
- **Validação de Interjornada Mínima de 11 Horas Consecutivas (`src/lib/servicos/validacao-interjornada.ts`):**
  - Implementação estrita do Artigo 66 da CLT e Súmula 110 do TST.
  - Verificação em tempo real no fluxo de cadastro de substituição/cobertura (`src/app/coberturas/page.tsx`).
  - Cálculo automático de déficit de descanso a indenizar (adicional de 50%).
  - Alertas visuais e checkbox obrigatório de declaração de ciência para coberturas emergenciais.
  - Registro de evento de quebra de interjornada na trilha de auditoria para fins de compliance trabalhista e fiscalização.
  - 8 testes unitários passando em `src/__tests__/validacao-interjornada.test.ts`.
- **Integração de Dados Reais dos Relatórios Operacionais:**
  - Extração e conciliação direta dos arquivos reais `CUBO DE REGISTROS.xlsx`, `CUBO DE ABONO.xlsx`, `08_Lista de Alocados_SIFAC_Agosto_.xlsx` e `funcionarios petrobras.XLSX`.
  - Endpoint de API em `/api/ponto` com suporte a persistência segura sem estouro da quota de 5MB do `localStorage`.
  - Suíte de conferência e não colisão de arquivos com 3 testes automatizados em `src/__tests__/conferencia-relatorios-momento4.test.ts`.
- **Painel Geral, Mapa de Ocupação e Presença Diária Multi-Base:**
  - Expansão da cobertura para as 29 bases operacionais do contrato Petrobras.
  - Drawer lateral de inspeção detalhada de célula no Mapa de Ocupação (`src/app/mapa-ocupacao/page.tsx`).
  - Identificação clara de Postos Vagos com badges de destaque.
  - Tratamento aprimorado de feriados nacionais e regras de admissão na apuração diária.
- **Métricas de Qualidade:**
  - Suíte completa com 150 testes automatizados Vitest passando (19 arquivos de teste).
  - 0 erros de TypeScript e compilação de produção verificada com sucesso.

---

## [Entrega Oficial — MOMENTO 4: Importação de Registros de Ponto, Interpretação de Escalas e Apuração de Presença Diária] — 17/09/2026

### O que ficou pronto:
- **Finalidade Estrita de Gestão:**
  - O SGP atua exclusivamente na gestão de presença diária, cobertura de postos e evidências contratuais para a fiscalização da Petrobras. Não substitui o sistema oficial de ponto nem faz apuração de folha (adicional noturno, horas extras, banco de horas).
- **Parser AFD Portaria MTP nº 671/2021 Anexo V (`src/lib/importadores/afd-ponto.ts`):**
  - Validação bloqueante de CNPJ da Premier Logistics (`01328799000120`) no cabeçalho do arquivo.
  - Flag obrigatória: `PENDENTE DE VALIDAÇÃO OFICIAL EM AMBIENTE HOMOLOGADO REP` explicitada na UI e no relatório.
  - Verificação rigorosa de sequência de NSR (Número Sequencial de Registro) com auditoria de continuidade.
  - Extração determinística de marcações tipo 3 (registro de ponto do empregado); descarte sumário conforme portaria de tipos 2, 4 e 5.
  - Rejeição total do arquivo com descarte de todas as marcações em caso de inconsistência estrutural (CNPJ divergente, NSR decrescente ou arquivo corrompido).
- **Parser de Planilhas com Mapeamento Configurável (`src/lib/importadores/planilha-ponto.ts`):**
  - Reconhecimento e mapeamento configurável de arquivos `.xlsx`, `.xls` e `.csv`.
  - Suporte de fábrica ao layout `CUBO DE REGISTROS.xlsx` do RM (colunas matriciais `ENT1`, `SAI1`, `ENT2`, `SAI2`, `ENT3`, `SAI3` e chave `CHAPA`).
  - Suporte de fábrica ao layout padrão do RHID (colunas `CPF`, `DATA`, `HORA`, `NSR`, `EQUIPAMENTO`).
  - Conversão resiliente de número serial e fração do Excel para data e hora no fuso local.
  - Minimização estrita LGPD: descarte sumário de fotos, selfies, IPs, geolocalização e nomes do arquivo de ponto (nomes e dados cadastrais vêm do RM).
  - Geração de relatório de validação XLSX em 3 abas (*Resumo*, *Marcações Importadas*, *Inconsistências*) e modelo XLSX para download.
- **Fusos Horários Contratuais e Armazenamento UTC (`src/lib/dados/secoes-horarios.ts` e `src/lib/dados/ponto-tipos.ts`):**
  - `America/Campo_Grande` (UTC-4) para UFN-III (Três Lagoas/MS).
  - `America/Manaus` (UTC-4) para REMAN (Manaus/AM).
  - `America/Sao_Paulo` (UTC-3) para as demais 27 bases operacionais do contrato.
  - Conversão determinística e armazenamento unificado em UTC ISO-8601 (`dataHoraUtc`).
- **Tabela SOMENTE DE INCLUSÃO e Rollback por Lote (`src/lib/dados/estado-operacional.ts`):**
  - Armazenamento em tabela de inclusão vinculada a lotes de importação.
  - Unicidade lógica por `colaboradorId + dataHoraUtc (minuto) + nsr`.
  - Suporte a rollback seguro ("Desfazer lote"), restaurando o snapshot anterior e registrando log de auditoria.
- **Interpretação de Horários e Escalas Cíclicas (`src/lib/servicos/interpretador-horarios.ts`):**
  - Sugestão automática de tipo de escala com base na descrição RM (`SEG/SEX`, `SEG/DOM`, `12X36`, `4X4`, `4X2`).
  - Suporte a jornadas noturnas que atravessam a meia-noite (marcações de saída no dia seguinte associadas à jornada iniciada no dia anterior).
  - Gestão de data-base de ciclo de trabalho por colaborador para escalas cíclicas com alternância de turnos.
- **Motor de Apuração Diária de Presença (`src/lib/servicos/apuracao-presenca.ts`):**
  - Ordem estrita de prioridade na apuração diária (1 a 9):
    1. `DESLIGADO` → 2. `FERIAS_AFASTADO_LICENCA` → 3. `FOLGA_ESCALA` → 4. `AUSENCIA_JUSTIFICADA` (Abonos do Momento 3) → 5. `PRESENTE` → 6. `MARCACAO_INCOMPLETA` → 7. `FALTA` → 8. `SEM_DADO` (após data de referência do lote) → 9. `ESCALA_NAO_CONFIRMADA`.
  - Tolerâncias contratuais de 10 minutos (atrasos ou saídas antecipadas sem penalização).
  - Alimentação das 7 situações de postos do Anexo 1-A (`P`, `C`, `D`, `V`, `–`, `A`, `?`).
  - Geração de pendências automáticas de ponto para a gestão operacional.
- **Novas Interfaces e Atualizações no Frontend:**
  - `/presenca-diaria`: Tabela diária com filtros por base operacional, situação, busca e cards estatísticos (com bloqueio a Fiscal Petrobras).
  - `/profissionais/[id]/espelho-ponto`: Espelho de presença do colaborador com calendário mensal, rastreabilidade de lote e log de auditoria.
  - `/admin/pendencias-ponto`: Gestão de inconsistências de ponto com justificativas operacionais.
  - `/admin/modelos-ponto`: Gerenciador de layouts configuráveis de mapeamento de colunas.
  - `/importacoes`: Upload unificado de AFD e planilhas de ponto, pré-visualização, download de relatório XLSX e rollback.
  - Cabeçalho global com indicador dinâmico: "Ponto até dd/mm hh:mm".
  - Menu lateral com links, ícones e badges de pendências.
- **Segregação RBAC e Conformidade LGPD:**
  - Fiscal Petrobras visualiza apenas a situação consolidada do posto (`P`, `C`, `D`, `V`, `–`, `A`, `?`), sem acesso a batidas individuais, espelhos ou detalhes clínicos de abonos.
- **Testes Automatizados Vitest:**
  - 26 novos testes adicionados (`importacao-afd-ponto-momento4.test.ts`, `importacao-planilha-ponto-momento4.test.ts`, `apuracao-presenca-momento4.test.ts`) utilizando exclusivamente dados sintéticos.
  - Total do projeto: **139 testes passando em 17 suítes (100% de sucesso)**.
  - Zero erros no TypeScript (`npx tsc --noEmit`).

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

# SGP — Sistema de Gestão de Postos

> **Solução Tecnológica para Fiscalização e Gestão de Postos de Serviço**  
> **Contratada:** Premier Logistics Gestão Empresarial Ltda.  
> **Contratante:** Petróleo Brasileiro S.A. – Petrobras  
> **Contrato ICJ:** 5900.0129796.25.2  

---

## 1. Visão Geral

O **SGP (Sistema de Gestão de Postos)** é a aplicação web responsiva corporativa desenvolvida para atender estritamente aos requisitos do **Item 11.3** do contrato com a Petrobras. A ferramenta permite aos gestores da Premier Logistics e aos Fiscais da Petrobras responderem com evidência auditável:

1. **Quem é o titular do posto?**
2. **O titular esteve presente? Se não, qual o motivo (categoria sem dado sensível)?**
3. **Houve substituição/cobertura? Por quem e em qual período?**
4. **O posto ficou descoberto em algum dia? Quantos dias?**
5. **Qual a consolidação que serve de base à conferência da Memória de Cálculo?**

---

## 2. Restrições e Governança de Infraestrutura

A infraestrutura é **exclusivamente**:
- **Vercel Pro**: Hospedagem da aplicação Next.js 15, com região de execução fixada em **São Paulo (`gru1`)**.
- **Neon PostgreSQL**: Banco de dados relacional na região **São Paulo (`aws-sa-east-1`)**, garantindo que todos os dados permaneçam em território nacional (Lei nº 13.709/2018 - LGPD).
- **GitHub**: Repositório de código-fonte.
- **Armazenamento de Arquivos**: Anexos de até 10 MB salvos diretamente em colunas `bytea` no PostgreSQL Neon, sem serviços de storage externos (sem S3, sem Cloudinary, etc.).

---

## 3. Inicialização Rápida (< 5 Minutos)

### Pré-requisitos
- **Node.js**: Versão 20+ (ou 22+)
- **Docker Desktop** (ou PostgreSQL 16 local instalado)

### Passo 1: Clonar o Repositório e Instalar Dependências
```bash
git clone <url-do-repositorio>
cd "Sistema de Gestão de Postos (SGP)"
npm install
```

### Passo 2: Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

### Passo 3: Iniciar o Banco de Dados Local
Suba o PostgreSQL 16 via Docker Compose:
```bash
docker compose up -d
```
*(Caso utilize uma instância PostgreSQL local existente, configure a porta 5432 e o banco `sgp_dev` no arquivo `.env`)*

### Passo 4: Executar as Migrações do Banco
Gere os tipos do Prisma e aplique a migração inicial:
```bash
npm run prisma:generate
npm run prisma:migrate
```

### Passo 5: Iniciar a Aplicação em Desenvolvimento
```bash
npm run dev
```
Acesse a aplicação no navegador em: **[http://localhost:3000](http://localhost:3000)**

---

## 4. Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local Next.js 15 em modo de desenvolvimento |
| `npm run build` | Compila o bundle otimizado de produção |
| `npm start` | Executa a versão de produção compilada |
| `npm test` | Executa os testes automatizados com o Vitest |
| `npm run lint` | Executa a verificação estática de código com ESLint |
| `npm run format` | Formata o código-fonte com Prettier |
| `npm run prisma:generate` | Gera o cliente tipado do Prisma |
| `npm run prisma:migrate` | Executa migrações no banco de dados local |
| `npm run prisma:studio` | Abre a interface visual do Prisma Studio |

---

## 5. Estrutura do Projeto

```
├── .env.example              # Exemplo de configuração de variáveis de ambiente
├── docker-compose.yml        # PostgreSQL 16 alpine para ambiente de desenvolvimento
├── vercel.json               # Configuração da Vercel fixando execução em gru1 (São Paulo)
├── prisma/
│   ├── schema.prisma         # Modelos de dados relacionais, enums e constraints
│   └── migrations/           # Histórico versionado de migrações SQL
├── src/
│   ├── app/                  # App Router do Next.js 15 (páginas e layouts)
│   │   ├── layout.tsx        # Layout raiz com cabeçalho, menu e rodapé LGPD
│   │   ├── page.tsx          # Painel inicial com indicadores e missão contratual
│   │   ├── conformidade/     # Matriz de requisitos contratuais (R1 a R5) e LGPD
│   │   ├── mapa-ocupacao/    # Grade central de postos x dias (recurso principal)
│   │   └── ...               # Demais módulos funcionais
│   ├── components/
│   │   ├── layout/           # Cabeçalho corporativo, Menu Lateral e Rodapé LGPD
│   │   └── ui/               # Componentes visuais acessíveis (Badges de status)
│   ├── lib/
│   │   ├── prisma.ts         # Singleton do PrismaClient para Serverless
│   │   └── utils.ts          # Utilitários de estilo
│   └── __tests__/            # Suíte de testes unitários com Vitest
└── docs/
    └── DEPLOY.md             # Guia de implantação na Vercel e Neon em São Paulo
```

---

## 6. Conformidade e LGPD

Todo acesso e manipulação de dados é segregado no servidor com política RBAC e auditoria contínua. Para detalhes sobre o tratamento de dados de saúde e minimização de dados para a Petrobras, consulte a rota `/conformidade` na aplicação e o documento `docs/LGPD.md`.

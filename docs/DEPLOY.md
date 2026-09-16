# Guia de Implantação e Infraestrutura — SGP

> **Aplicação:** SGP — Sistema de Gestão de Postos  
> **Contrato:** ICJ 5900.0129796.25.2 (Petrobras • Premier Logistics)  
> **Infraestrutura:** Vercel Pro (gru1) + Neon PostgreSQL (aws-sa-east-1)  

---

## 1. Visão Geral da Infraestrutura

Em cumprimento estrito às cláusulas contratuais e à Lei Geral de Proteção de Dados (Lei nº 13.709/2018), toda a infraestrutura do SGP opera **exclusivamente no Brasil (São Paulo)**, sem envio de dados ou chamadas a serviços de terceiros não autorizados.

```
+-------------------------------------------------------------+
|                  INFRAESTRUTURA EM SÃO PAULO                |
|                                                             |
|   +---------------------+       +-----------------------+   |
|   |   Vercel Pro (gru1) | ----> |   Neon PostgreSQL     |   |
|   |   Next.js 15 App    |       |   Região: aws-sa-east-1|  |
|   |   Serverless Fn     |       |   (São Paulo)         |   |
|   +---------------------+       +-----------------------+   |
|              |                                              |
|              v                                              |
|   +---------------------+                                   |
|   |  Anexos em Bytea    |                                   |
|   |  (Salvos no Banco)  |                                   |
|   +---------------------+                                   |
+-------------------------------------------------------------+
```

---

## 2. Passo a Passo: Provisionamento do Banco no Neon

1. Acesse o console da [Neon](https://console.neon.tech).
2. Crie um novo projeto com o nome `sgp-premier`.
3. **CRÍTICO — Seleção de Região:**
   - Selecione a região **`South America (São Paulo) - aws-sa-east-1`**.
   - **NÃO** utilize regiões dos EUA ou Europa, pois violaria o requisito de soberania e territorialidade dos dados pessoais do contrato Petrobras.
4. Ao concluir a criação, a Neon disponibilizará a Connection String.
5. Obtenha **duas** URLs de conexão na aba "Dashboard / Connection Details":
   - **Connection Pooling (`-pooler`):** Habilite a opção "Connection Pooling" (porta pgbouncer). Esta URL será usada na variável `DATABASE_URL`.
   - **Direct Connection:** Desmarque o pooling para obter a conexão direta sem pgbouncer. Esta URL será usada na variável `DIRECT_URL` para o Prisma executar as migrations sem interferência do proxy transacional.

---

## 3. Passo a Passo: Configuração do Projeto na Vercel

1. Acesse o [Vercel Dashboard](https://vercel.com) com a conta corporativa Premier (Plano Pro).
2. Clique em **Add New... > Project** e importe o repositório GitHub do SGP.
3. Configure o Framework Preset como **Next.js**.
4. Em **Root Directory**, certifique-se de apontar para a raiz do repositório.

### 3.1. Fixação da Região de Execução em São Paulo (`gru1`)
Para garantir latência ultrabaixa até o banco Neon e assegurar que as funções Serverless executem no Brasil:
1. O repositório já inclui o arquivo `vercel.json` na raiz com:
   ```json
   {
     "regions": ["gru1"],
     "framework": "nextjs"
   }
   ```
2. No código-fonte, o layout raiz (`src/app/layout.tsx`) declara:
   ```typescript
   export const preferredRegion = "gru1";
   ```
3. No painel da Vercel, em **Settings > Functions > Function Region**, certifique-se de que está selecionado **São Paulo, Brazil (gru1)**.

---

## 4. Variáveis de Ambiente a Configurar na Vercel

No painel do projeto na Vercel, acesse **Settings > Environment Variables** e cadastre as seguintes chaves para os ambientes **Production** e **Preview**:

| Variável | Descrição / Exemplo | Obrigatória |
| :--- | :--- | :---: |
| `DATABASE_URL` | String de conexão do Neon com pooling (`-pooler.sa-east-1.aws.neon.tech`) com `?sslmode=require&pgbouncer=true` | **Sim** |
| `DIRECT_URL` | String de conexão direta do Neon sem pooling (`.sa-east-1.aws.neon.tech`) com `?sslmode=require` | **Sim** |
| `NEXTAUTH_URL` | URL canônica da aplicação (ex: `https://sgp.premierlogistics.com.br` ou domínio da Vercel) | **Sim** |
| `NEXTAUTH_SECRET` | Hash de 32+ caracteres criptográficos aleatórios para assinar os tokens de sessão | **Sim** |
| `CPF_ENCRYPTION_KEY` | Chave de 32 bytes em hexadecimal (64 chars) para cifragem AES-256-GCM em repouso | **Sim** |
| `APP_ENV` | `production` (em produção) ou `preview` (em homologação) | **Sim** |

> [!CAUTION]
> **Segregação de Ambientes:** Nunca utilize o banco de dados de Produção no ambiente de Preview/Homologação. No Neon, crie um *branch* ou banco separado (`sgp_preview`) para testes com dados fictícios.

---

## 5. Script de Build e Migrations

No painel da Vercel, configure o comando de build padrão em **Settings > General > Build & Development Settings**:

- **Build Command:** `npx prisma generate && npx prisma migrate deploy && next build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

Isso assegura que toda nova versão na branch `main` aplique automaticamente as migrações no banco Neon antes de colocar o novo bundle no ar.

---

## 6. Procedimento de Rollback

Em caso de necessidade de reversão imediata:
1. Acesse **Deployments** no painel da Vercel.
2. Localize a versão estável anterior que foi homologada.
3. Clique no menu de opções (`...`) e selecione **Rollback to this deployment**.
4. A Vercel redirecionará o tráfego em tempo zero (< 1 segundo).

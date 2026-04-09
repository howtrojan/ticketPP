# TicketPP (MVP) — SaaS de venda de ingressos

Plataforma inspirada em ticketing moderno (UX premium, responsivo, dark mode) com foco em MVP real:
- Catálogo e detalhe de eventos
- Seleção por setor (GA) ou assento (SEATED)
- Reserva temporária (Redis TTL 7 minutos) para evitar overselling
- Checkout Stripe (hosted) + webhook para confirmar pedido e marcar tickets como vendidos
- Área do usuário com histórico de pedidos
- Admin (CRUD básico) para locais, setores, eventos, lotes e geração de ingressos
- Busca com OpenSearch (com fallback no Postgres quando não configurado)

## Stack
- Next.js 15 + React + TypeScript (monólito modular, App Router)
- UI: Tailwind + shadcn/ui
- DB: PostgreSQL (Prisma)
- Cache/locks: Redis
- Busca: OpenSearch
- Auth: NextAuth (credentials + Prisma)
- Pagamentos: Stripe (estrutura preparada para adapter Mercado Pago)

## Rodar localmente

### 1) Subir Postgres + Redis + OpenSearch
```bash
docker compose up -d
```

### 2) Configurar variáveis de ambiente
Crie um `.env` a partir do `.env.example`:
```bash
copy .env.example .env
```

Edite `NEXTAUTH_SECRET` e (opcionalmente) chaves do Stripe.

### 3) Migrar e seed
```bash
npm run prisma:migrate
npm run db:seed
```

Credenciais seed:
- Admin: `admin@local.test` / `admin123`

### 4) Rodar o app
```bash
npm run dev
```

Páginas:
- Home: http://localhost:3000
- Catálogo: http://localhost:3000/eventos
- Minha conta: http://localhost:3000/conta
- Admin: http://localhost:3000/admin

## Stripe (checkout + webhook)

1) Crie um projeto no Stripe e copie as chaves para o `.env`:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

2) Em dev, use o Stripe CLI para encaminhar webhooks:
```bash
stripe listen --forward-to http://localhost:3000/api/payments/stripe/webhook
```

Depois, use o `STRIPE_WEBHOOK_SECRET` exibido pelo `stripe listen`.

## OpenSearch (busca)

Com `OPENSEARCH_NODE=http://localhost:9200` configurado, reindexe:
- Abra `/admin` e clique em “Reindexar busca”.

## Deploy

### Opção A — Monólito na Vercel (recomendado para MVP)
- O app usa Route Handlers do Next, então pode rodar como monólito na Vercel.
- Provisione serviços gerenciados:
  - Postgres: Vercel Postgres, Neon, Supabase ou RDS.
  - Redis: Upstash Redis.
  - OpenSearch: opcional (Bonsai/Elastic Cloud/AWS OpenSearch). Sem isso, a busca cai no fallback por Postgres.
  - Stripe: chaves live.
- Variáveis de ambiente na Vercel (Project Settings → Environment Variables):
  - DATABASE_URL
  - REDIS_URL
  - NEXTAUTH_SECRET
  - NEXTAUTH_URL (URL pública do projeto, ex.: https://seuapp.vercel.app)
  - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
  - OPENSEARCH_NODE (opcional), OPENSEARCH_USERNAME/OPENSEARCH_PASSWORD (se exigido)
- Migrações/seed de produção:
  - Execute localmente apontando para a base de produção:
    - `DATABASE_URL="postgres://..." npm run prisma:migrate`
    - `DATABASE_URL="postgres://..." npm run db:seed`
  - Alternativamente, use “one-off tasks”/CI para `prisma migrate deploy`.
- Stripe Webhook (produção):
  - Configure no Stripe Dashboard o endpoint `https://SEU_DOMINIO/api/payments/stripe/webhook`.
  - Cole o segredo em `STRIPE_WEBHOOK_SECRET`.
- OpenSearch (opcional):
  - Após setar o cluster e envs, use o botão “Reindexar busca” em `/admin`.

### Opção B — Frontend na Vercel e o mesmo app em provider de Node (Render/Railway/Fly)
- Também funciona rodar este monólito como um servidor Next em Node:
  - Build: `npm run build`
  - Start: `npm start`
  - Node: 18+ (ideal 20).
  - Porta: 3000 (defina no serviço).
- Configure as mesmas variáveis de ambiente da opção A.
- Migrações/seed:
  - Recomendado rodar localmente contra a base de produção:
    - `DATABASE_URL="postgres://..." npm run prisma:migrate`
    - `DATABASE_URL="postgres://..." npm run db:seed`
- Stripe Webhook:
  - Endpoint: `https://SEU_BACKEND/api/payments/stripe/webhook`.
  - Atualize `NEXTAUTH_URL` para a URL pública do app.

## Checklist pós-deploy
- Variáveis de ambiente:
  - Defina `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
  - Se tiver checkout: `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`.
  - Se usar busca: `OPENSEARCH_NODE` (+ usuário/senha se necessário).
- Banco:
  - Aplique migrações: `prisma migrate deploy` (ou migre local apontando para prod).
  - Opcional: rode um seed controlado para criar um admin e eventos iniciais.
- Acesso:
  - Abra `/auth/login` e entre com o admin.
  - Verifique `/admin` carrega; crie um local, setor e evento de teste.
- Catálogo/Busca:
  - Publique um evento e clique “Reindexar busca” em `/admin` (se OpenSearch ativo).
  - Verifique `/eventos` lista e busca por título/cidade.
- Reserva (anti-oversell):
  - Na página do evento, selecione um assento/setor e confirme que o badge de tempo aparece (7 min).
  - Em outro navegador/aba anônima, tente reservar o mesmo ticket — deve vir bloqueado.
- Checkout/Stripe:
  - Inicie um checkout a partir de um ticket em hold.
  - Pague com cartão de teste; após o retorno, confira `/conta` com o pedido “PAID”.
  - Verifique no banco que os `tickets` foram marcados como `SOLD` e que o `hold` foi removido.
- Webhook:
  - Em dev, use `stripe listen --forward-to /api/payments/stripe/webhook` e refaça um teste.
  - Em prod, confira no Stripe Dashboard que o endpoint recebeu `checkout.session.completed`.
- Rate limiting:
  - Faça várias chamadas rápidas à criação de hold para validar retorno `429` em excesso.
- Permissões:
  - `/admin` apenas para usuários com `role=ADMIN`; `/conta` exige login.

## Stripe — cartões de teste (dev)
- Aprovado sem autenticação: 4242 4242 4242 4242 (qualquer data futura, CVC 123, CEP qualquer)
- SCA/3DS obrigatório (sucesso): 4000 0027 6000 3184
- Autenticação falha: 4000 0027 6000 3178
- Pagamento recusado (declined): 4000 0000 0000 9995
- Fundos insuficientes: 4000 0000 0000 9994

## Troubleshooting
- Docker não sobe serviços:
  - Portas ocupadas (5432/6379/9200): ajuste as portas no `docker-compose.yml` ou pare serviços locais.
  - OpenSearch falha por memória: este compose já limita JVM para 512MB; se persistir, use WSL2 no Windows ou aumente recursos.
- Prisma/Migrations:
  - `DATABASE_URL` ausente/errado: confira `.env`.
  - Erros de permissão: garanta usuário com permissão de criar tabelas e rode `npm run prisma:migrate`.
- Auth:
  - Erro de JWT/session: defina `NEXTAUTH_SECRET` e `NEXTAUTH_URL`.
- Redis/Hold:
  - API retorna `NO_REDIS`: suba o container Redis e confira `REDIS_URL`.
- Stripe Webhook:
  - `INVALID_SIGNATURE`: use `stripe listen --forward-to http://localhost:3000/api/payments/stripe/webhook` e cole o segredo em `STRIPE_WEBHOOK_SECRET`.
  - Endpoint incorreto em prod: configure a URL pública `/api/payments/stripe/webhook` no Stripe Dashboard.
- OpenSearch:
  - Sem OpenSearch configurado, a busca cai no fallback SQL; ao ativar, use “Reindexar busca” no `/admin`.
- Windows dicas:
  - Cópia de env: PowerShell `copy .env.example .env`; Git Bash `cp .env.example .env`.

## Arquitetura (visão rápida)
- Fonte de verdade: PostgreSQL (Prisma)
- Anti-oversell:
  - Redis `SET NX EX 420` em `hold:ticket:<ticketId>`
  - Tickets viram `SOLD` somente no webhook do Stripe
  - `OrderItem.ticketId` é único (impede que 2 pedidos incluam o mesmo ticket)
- Módulos (na prática, organizados por libs + rotas):
  - Auth: `src/lib/auth.ts`, `src/app/api/auth/*`
  - Events: `src/app/api/events/*`, `src/app/eventos/*`
  - Booking/holds: `src/app/api/booking/hold`
  - Payments: `src/app/api/payments/stripe/*`
  - Users: `src/app/conta/*`, `src/app/api/me/orders`
  - Admin: `src/app/admin/*`, `src/app/api/admin/search/reindex`

## Roadmap v2 (sugestão)
- Mapa de assentos completo (SVG + zoom/pan + agrupamentos por fila/coluna)
- Carrinho multi-ticket + renovação de hold (keep-alive com limites)
- Mercado Pago adapter (Pix + boleto) com webhooks
- Filas e processamento assíncrono (BullMQ/Redis) para indexação e emails
- Observabilidade: tracing + logs estruturados com correlação (requestId)
- Limites por conta/cliente e multi-tenant (SaaS real)
- Gateways anti-bot e antifraude em rotas críticas

# V ACT Client Portal

Client document collection and reminder portal for **V ACT Management Services Sdn Bhd**, built by Quantinity.

Clients upload the documents V ACT asks for through their own login and always see what is still missing. Staff
review, approve or request changes, and can upload on a client's behalf. Reminders go out by WhatsApp (Meta Cloud
API) and email (Resend) on rules the admin defines, stop automatically when the client uploads, and every message is
logged as sent, delivered and read.

> Demo build. Runs on the developer's Mac only; see `DEMO-SCRIPT.md` for the walkthrough and `docs/DECISIONS.md`
> for the small calls made along the way. Hosting comes after V ACT approves.

## Stack

Next.js 16 (App Router, TypeScript strict, Server Actions + Route Handlers) · PostgreSQL 16 + Prisma 7 ·
Tailwind CSS v4 + shadcn/ui · Resend + React Email · WhatsApp Cloud API · Vitest · pnpm · Node 20 LTS.

## Run it locally

```bash
docker compose up -d db      # Postgres 16 on localhost:5432 (named volume)
cp .env.example .env         # then fill in the values you have
pnpm install
pnpm db:reset                # drop, migrate, seed in one go (idempotent seed)
pnpm dev:all                 # web on http://localhost:3000 + reminder worker
```

Demo logins (all `Demo1234!`): `admin@vact.demo`, `aisyah@vact.demo`, `daniel@vact.demo`, `client@vact.demo`.

Useful scripts: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm db:seed`, `pnpm db:migrate`, `pnpm db:studio`.

_(Setup notes for the Meta test number, Resend and the webhook options are added in Phase 4.)_

# Decisions

Small choices made while building, where the spec left room. Larger questions were raised before building.

| # | Decision | Why |
|---|---|---|
| 1 | Prisma 7 with the `pg` driver adapter (`@prisma/adapter-pg`) and the `prisma-client` generator | Current stable major; no Rust query engine to download at install time, same client in the Next app, the worker and the seed. |
| 2 | Next.js 16 with `cacheComponents: false` | Every authenticated page is per-request and reads the database; the classic dynamic rendering model needs no Suspense boundaries around every data read. |
| 3 | shadcn/ui components are vendored in `src/components/ui` (Radix via the `radix-ui` package) | Same API as the shadcn registry; `components.json` is kept so more components can be added with `pnpm dlx shadcn add <name>`. |
| 4 | Inter is self-hosted via `@fontsource-variable/inter` | No Google Fonts request at build or run time; the demo works offline. |
| 5 | Session = signed JWT (jose, HS256) in an HTTP-only cookie, 12 h | No session table needed; every request still loads the user from the database so a disabled account is locked out immediately. |
| 6 | Set-password / reset tokens are stored as SHA-256 hashes | The raw token only ever exists in the link. |
| 7 | Rate limiting is in-process (per IP + email) | Single process in the demo; swap for Redis when the app is clustered. |
| 8 | `ReminderJob.lockedAt` added | Lets the worker and the "Run reminders now" button run `tick()` at the same time without double-sending. |
| 9 | `MessageLog.kind`, `MessageLog.simulated`, `MessageLog.jobId` added | The delivery log needs to label rows (invite, reminder, escalation…), show the "Simulated" badge and link back to the job. |
| 10 | The "new request" notification is sent directly (MessageLog kind `NEW_REQUEST`), not stored as a ReminderJob | It must go out immediately; keeping it out of ReminderJob keeps the escalation count equal to real reminders. |
| 11 | Escalation counts reminder occasions, not channel jobs | A BOTH-channel reminder creates two jobs for one moment; `escalateAfter = 3` means three reminders, not 1.5. |
| 12 | Simulated email (no `RESEND_API_KEY`) also progresses to delivered/read like simulated WhatsApp | Keeps the demo coherent when neither provider is configured. |
| 13 | Due dates are `DATE` columns interpreted in Asia/Kuala_Lumpur | "Overdue" is a calendar question for the firm, not a UTC instant. |
| 14 | Initial migration SQL written to match the Prisma schema | Equivalent to `prisma migrate dev --name init`; later schema changes use `pnpm db:migrate` as normal. |
| 15 | No automatic reminders while a request is in CHANGES_REQUESTED | The spec cancels jobs when a request leaves PENDING and only sends for PENDING requests; the change-request notification itself tells the client what to do, and staff see it under "Action needed". |
| 16 | Webhook signature checks are skipped only when the matching secret env var is empty | Lets the demo run without ngrok; with `WHATSAPP_APP_SECRET` / `RESEND_WEBHOOK_SECRET` set, unsigned or tampered calls get 401. |
| 17 | A late or out-of-order provider status never downgrades a message (a `sent` after `delivered` is ignored); `failed` always wins unless the message was already read | Meta can deliver status events out of order. |
| 18 | A REPEAT chain continues even when one send fails (not when it is skipped for lack of a contact) | A transient provider error should not silently end the chasing. |
| 19 | `POST /api/cron/tick` accepts an admin session or `Authorization: Bearer $CRON_SECRET` | The UI button and any external scheduler use the same route. |
| 20 | `User.notificationEmail` added (seed only) | The demo login must stay `client@vact.demo` while live emails need to reach the developer's real inbox (Resend's test sender only delivers to the account owner). All sending goes through `emailFor(user)`. |
| 21 | Seed data is relative to today | `pnpm db:reset` on any day gives the same picture: overdue by 3–20 days, due in 3–30 days, two jobs due one minute ago. |
| 22 | `ALLOWED_DEV_ORIGINS` env for `allowedDevOrigins` | Next 16 blocks cross-origin dev requests; needed to open the dev server from a phone on the LAN or through ngrok. |
| 23 | Vercel hosting: private Vercel Blob via the storage adapter, cron `GET /api/cron/tick` instead of the worker, `MAX_UPLOAD_MB` cap | Irfan chose Vercel (dev quantinity) for the demo URL on 10 Nov 2026. The droplet plan in the spec still works unchanged; nothing assumes Vercel. |

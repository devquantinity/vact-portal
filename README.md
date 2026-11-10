# V ACT Client Portal

Client document collection and reminder portal for **V ACT Management Services Sdn Bhd**, built by Quantinity.

- Clients sign in, see exactly which documents are pending, overdue, awaiting review or approved, and upload from a
  phone or a laptop.
- Staff review each upload (approve or request changes with a comment), can upload on a client's behalf, and see
  every message ever sent for a company.
- Reminders go out by **WhatsApp (Meta Cloud API)** and **email (Resend)** on rules the admin writes in plain language,
  and **stop automatically** the moment the client uploads.
- Every message is logged as **sent → delivered → read** (or failed, with the provider's reason), with a CSV export.

> Demo build. It runs on the developer's Mac; hosting and the items under *Phase 2 ideas* come after V ACT approves.
> `DEMO-SCRIPT.md` has the 10-minute walkthrough and `docs/DECISIONS.md` the small calls made along the way.

## Stack

Next.js 16 (App Router, TypeScript strict, Server Actions + Route Handlers) · PostgreSQL 16 + Prisma 7 ·
Tailwind CSS v4 + shadcn/ui · React Email + Resend · WhatsApp Cloud API · Vitest · pnpm · Node 20 LTS.

## Run it locally

All commands run on the Mac, in the repo folder (`~/side-project/quantinity/vact-portal`).

```bash
docker compose up -d db      # Postgres 16 on localhost:5432, data in a named volume
cp .env.example .env         # then edit .env (see the table below)
pnpm install                 # also runs prisma generate
pnpm db:reset                # drop + migrate + seed, replayable any time
pnpm dev:all                 # web on http://localhost:3000 and the reminder worker, side by side
```

Demo logins (password `Demo1234!` for all):

| Role | Email | Sees |
|---|---|---|
| Admin | `admin@vact.demo` | Everything: setup, delivery log, settings, audit log |
| Staff | `aisyah@vact.demo` | Hafiz Trading, Nusantara Agro, Kedai Kopi Warisan, Bayu Logistik, Seri Mutiara |
| Staff | `daniel@vact.demo` | TechNova, Lim & Tan, Puncak Hijau, Delima Fashion, Borneo Harvest |
| Client | `client@vact.demo` | Hafiz Trading Sdn Bhd (notifications go to `SEED_DEMO_EMAIL` / `SEED_DEMO_PHONE`) |
| Client | `rosli@hamidholdings.demo` | A director linked to two companies (company switcher) |

Other scripts: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm db:seed` (idempotent, re-runnable), `pnpm db:migrate`,
`pnpm db:studio`, `pnpm worker` (scheduler only). Prisma 7 no longer seeds after `migrate reset`, so `db:reset` runs
`prisma db seed` explicitly.

### Environment variables

Copy `.env.example` to `.env` in the repo folder and fill in what you have. Everything provider-related is an env
var, so the same code runs on a laptop today and on a server later.

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Postgres connection; the default matches `docker-compose.yml` |
| `APP_URL` | Base URL used in links inside messages. `http://localhost:3000` on the laptop; the ngrok URL or `http://<Mac LAN IP>:3000` when a phone must open the links |
| `SESSION_SECRET` | Signs the session cookie and download links (32+ random characters) |
| `UPLOAD_DIR` | Where files are stored (`./uploads`, never served statically) |
| `CRON_SECRET` | Bearer token for `POST /api/cron/tick` from outside the UI |
| `ALLOWED_DEV_ORIGINS` | Extra hosts allowed to open the dev server, e.g. `192.168.0.12,*.ngrok-free.app` |
| `WHATSAPP_MODE` | `live` or `simulate` (see below) |
| `GRAPH_API_VERSION`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta Cloud API credentials |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Webhook signature check and verification handshake |
| `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE` | The approved utility template (`vact_reminder`, `en`) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` | Email sending and the Svix-signed status webhook |
| `SEED_DEMO_PHONE`, `SEED_DEMO_EMAIL` | Your own verified WhatsApp number and inbox; the seed attaches them to `client@vact.demo` so live sends land on your phone |

### Simulated vs live

- **WhatsApp**: `WHATSAPP_MODE=simulate` makes no network call. Messages are logged as SENT with a fake id
  `sim-<uuid>`; the worker marks them DELIVERED on the next tick and READ on the one after. The UI shows a
  *Simulated* badge. `WHATSAPP_MODE=live` sends through the Meta Cloud API.
- **Email**: with no `RESEND_API_KEY` emails are simulated the same way. With a key they go out through Resend.
- Simulated and live rows live in the same delivery log, so a demo can mix them.

## WhatsApp: Meta test number setup

Do this once in [developers.facebook.com](https://developers.facebook.com) (a Meta Business account is created for
you if you do not have one):

1. **My Apps → Create App → Business** (or *Other → Business*). Then **Add product → WhatsApp → Set up**.
2. **WhatsApp → API Setup**. Copy the *Phone number ID* → `WHATSAPP_PHONE_NUMBER_ID`, the *WhatsApp Business Account
   ID* → `WHATSAPP_BUSINESS_ACCOUNT_ID`, and the temporary access token → `WHATSAPP_ACCESS_TOKEN` (valid 24 hours;
   for a longer token create a **System User** under *Business settings → Users → System users*, assign the app
   and the WhatsApp account with `whatsapp_business_messaging` and `whatsapp_business_management`, and generate a
   token there).
3. Still on *API Setup*, under **To**, add and verify the phone numbers that may receive messages. **The test number
   can only message up to 5 verified recipients.** Add your own number first and put it in `SEED_DEMO_PHONE`.
4. **App settings → Basic → App secret** → `WHATSAPP_APP_SECRET`.
5. Create the message template. Business-initiated messages must use an **approved template**; the portal uses one
   utility template for everything so the admin keeps full control of the wording:
   - **WhatsApp Manager → Message templates → Create template**
   - Category **Utility**, name **`vact_reminder`**, language **English**
   - Body (copy exactly):

     ```
     Hello {{1}}, this is a message from V ACT Management Services about your company. Details: {{2}} You can open your portal at {{3}} to upload the documents. Thank you.
     ```

   - Sample values when asked: `Hafiz`, `Bank statements for Hafiz Trading Sdn Bhd are due on 25 Nov 2026 (3 days left).`,
     `https://portal.v-act.com.my/login`
   - Submit. **The template must be approved before live sending works** (usually minutes, sometimes hours).
     Parameter 1 is the client name, 2 is the reminder type's rendered body collapsed to one line (Meta allows no
     newlines, tabs or more than 4 spaces in a row, and caps the whole body at 1,024 characters, so long bodies are
     truncated with "..."), 3 is the login link.
   - Optional nicer variant: add a **URL button** with a dynamic suffix instead of putting the link in the body.
6. Set `WHATSAPP_MODE=live` in `.env`, restart `pnpm dev:all`, open **Admin → Reminder types → any rule → Send test
   message**. The message should arrive on the admin's phone within seconds (the admin's phone number must be one of
   the verified recipients).

Sending works from the laptop with no public URL. Only the **status webhook** (delivered / read receipts) needs one;
see the two options below.

## Email: Resend setup

1. Create an account at [resend.com](https://resend.com) → **API Keys → Create API key** → `RESEND_API_KEY`.
2. Until a domain is verified, keep `EMAIL_FROM="V ACT Client Portal <onboarding@resend.dev>"`. Resend then only
   delivers to **the email address of your own Resend account**, so put that address in `SEED_DEMO_EMAIL` (the seed
   attaches it to `client@vact.demo` as the notification address; the login stays `client@vact.demo`) and use it for
   the admin account if you want to receive staff emails too.
3. After V ACT approves, verify `v-act.com.my` in Resend and switch `EMAIL_FROM` to `portal@v-act.com.my` (or the
   Quantinity domain in the meantime).
4. For delivery receipts: **Webhooks → Add endpoint** → `https://<your ngrok host>/api/webhooks/resend`, events
   `email.sent`, `email.delivered`, `email.opened`, `email.bounced`, `email.complained` → copy the signing secret
   (`whsec_…`) → `RESEND_WEBHOOK_SECRET`. `email.opened` needs open tracking enabled on the sending domain.

## Webhooks during the demo: two options

**Option A — ngrok for the hour (real delivered/read ticks).**

1. On the Mac: `brew install ngrok` (once), then in a second terminal `ngrok http 3000`. Copy the `https://….ngrok-free.app` URL.
2. Meta: **App dashboard → WhatsApp → Configuration → Webhook → Edit**. Callback URL
   `https://<ngrok host>/api/webhooks/whatsapp`, Verify token = the value of `WHATSAPP_VERIFY_TOKEN` in `.env`.
   Click *Verify and save*, then **Manage → subscribe to `messages`**.
3. Resend: add the endpoint from the email section with `https://<ngrok host>/api/webhooks/resend`.
4. Put the host in `ALLOWED_DEV_ORIGINS` and, if the phone should open the links from WhatsApp, set `APP_URL` to the
   ngrok URL and restart `pnpm dev:all`.
5. Send a test. The delivery log row moves Sent → Delivered → Read as Meta posts the status updates.

**Option B — no public URL.** Leave the webhooks unset and keep `WHATSAPP_MODE=simulate`; the log shows delivered and
read ticks from the simulator. Switch to `live` for one real message to prove the API works; that row stays at *Sent*
(no receipts can reach the laptop), which is honest and easy to explain.

## How the reminder engine works

- `pnpm worker` runs `tick()` every 60 seconds; **Admin → Settings → Run reminders now** runs the same code on demand
  and reports sent / skipped / failed / held.
- Creating a request generates one job per channel for each *days before* value at 09:00 Kuala Lumpur, plus the first
  *repeat* job the day after the due date. Jobs already in the past are dropped. The client gets a "new request"
  notification immediately on the rule's channels.
- A tick claims each due job (so the worker and the button never double-send), skips it if the request is no longer
  pending, holds it until the send window opens (09:00–18:00 Kuala Lumpur, weekends skipped when configured), then
  renders the templates per contact and channel, writes one MessageLog row per message, and marks the job SENT or
  FAILED. Repeat jobs re-schedule themselves every *N* days until the client uploads; after the configured number of
  reminders with no upload the assigned officer (or all admins) gets an escalation email.
- Any upload, approval or cancellation cancels every scheduled job for that request.

Placeholders available in every template: `{client_name}`, `{company}`, `{document}`, `{due_date}`, `{days_left}`,
`{link}`, `{staff_name}`, `{staff_phone}`, `{firm}`. Unknown placeholders are left as-is and flagged in the editor.

## Routes worth knowing

| Route | Purpose |
|---|---|
| `GET /api/health` | `{ status, db, worker: { lastTick, alive } }` |
| `POST /api/cron/tick` | Run the scheduler (admin session or `Authorization: Bearer $CRON_SECRET`) |
| `GET/POST /api/webhooks/whatsapp` | Meta verification handshake and status updates (signature checked when `WHATSAPP_APP_SECRET` is set) |
| `POST /api/webhooks/resend` | Resend events (Svix signature checked when `RESEND_WEBHOOK_SECRET` is set) |
| `GET /api/files/:documentId?exp&sig` | Signed, 10-minute download bound to the signed-in user |
| `GET /api/admin/messages/export` | Delivery log CSV with the same filters as the page |

## Security notes

Every page, server action and route handler checks the session and role (`requireRole`, `requireApiRole`); clients can
only touch requests of companies they are linked to. Login and forgot-password are rate limited (5 attempts per 15
minutes per IP + email). Files are never served from a public path, uploads are checked against the real MIME type
sniffed from the bytes, and the audit log records logins, invites, uploads, review decisions, rule and settings
changes and manual scheduler runs.

## Phase 2 ideas (not in this build)

Hosting on a DigitalOcean droplet behind Caddy with a V ACT subdomain · DigitalOcean Spaces storage with backup
bucket · auto-calculated compliance deadlines from incorporation date and FYE · bulk Excel import of clients · Meta
Coexistence with V ACT's existing WhatsApp number · per-client language setting · public-holiday calendar · ticket
system · payment links · e-signature · SSM / LHDN filing integrations · PDPA data-residency (AWS Malaysia) variant ·
client self-registration · two-factor authentication · daily Postgres backups and 90-day log retention.

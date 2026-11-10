# Demo script — V ACT Client Portal (10 minutes)

Goal: prove the four things V ACT cares about, in this order.

1. Clients upload through their own login and see exactly what is still missing.
2. Staff review, approve or request changes, and can upload on a client's behalf.
3. Reminders go out by WhatsApp and email on rules the admin defines, and stop automatically on upload.
4. Every message is logged as sent, delivered and read.

## Before the meeting (5 minutes, on the Mac)

In the repo folder `~/side-project/quantinity/vact-portal`:

1. Check `.env`: `WHATSAPP_MODE=live`, Meta credentials filled, `SEED_DEMO_PHONE` = your WhatsApp number,
   `SEED_DEMO_EMAIL` = the client login/inbox, `SEED_ADMIN_EMAIL` and `SEED_PASSWORD` as you want them,
   `RESEND_API_KEY` set. (Fallback: `WHATSAPP_MODE=simulate` and the demo still works.)
2. Optional, for real delivered/read ticks: second terminal `ngrok http 3000`, paste the URL into the Meta webhook
   settings (README → Webhooks), add the host to `ALLOWED_DEV_ORIGINS` and set `APP_URL` to the ngrok URL so links in
   WhatsApp open on your phone.
3. `docker compose up -d db`
4. `pnpm db:reset && pnpm dev:all` — wait for *Ready* and `[worker] started`.
5. Open two browser windows side by side: **Window A** (staff) at `http://localhost:3000`, **Window B** (client) as a
   private/incognito window, narrowed to phone width (or Chrome DevTools device mode, iPhone 14).
6. Keep your phone on the table with WhatsApp open.

Every login uses the password in `SEED_PASSWORD`; the admin is `SEED_ADMIN_EMAIL`, the client is `SEED_DEMO_EMAIL`,
staff are `aisyah@` and `daniel@` the admin's domain. Below, `admin@vact.demo` and `client@vact.demo` stand for whatever
you set.

## 0:00 — The problem, in one screen (Admin dashboard)

- Window A: sign in as `admin@vact.demo`.
- Point at the cards: **5 overdue**, **5 awaiting review**, **93% delivered / 59% read**, **2 open escalations**.
- Scroll to **Overdue requests**: "the portal already knows who is late, by how much, and how many reminders they
  have had." Note Puncak Hijau: 4 reminders, number bounced, escalated to Daniel.

## 1:30 — Rules the admin controls (Reminder types)

- Sidebar **Reminder types** → open **Annual Return (SSM)**.
- Read the rule sentence under *Rule*: "30, 14, 7 and 1 day before, then every 2 days after the due date until uploaded,
  staff alerted after 4."
- Change the WhatsApp text (add a word), watch the **live preview** update. Click a placeholder chip to insert
  `{days_left}`. Type `{foo}` and show the *unknown placeholder* warning, then remove it.
- Click **Send test message** → your phone buzzes with the real WhatsApp. "That is the Meta Cloud API, the official
  one. No unofficial automation, no risk of a banned number."
- Open **Peringatan dokumen (BM)**: "same engine, Malay wording — any language."

## 3:00 — Creating a request (Staff)

- Sidebar **New request**. Company **Hafiz Trading Sdn Bhd**, document **Management accounts** is already pending, so
  pick **Payroll summary (Form E)**, rule **Document request (standard)**, due date **10 days from today**, instructions
  "Payroll summary Jan to Oct 2026."
- Show the **Reminder schedule** panel: "WhatsApp + email on these dates, then every 3 days until uploaded. Staff alerted
  after 3." Click **Confirm and notify client**.
- Your phone buzzes again: the client just got the new-request WhatsApp; the email is in your inbox.
- The request's own page opens. The blue box says who we are waiting for and when the next reminder goes out;
  **Reminders** lists the exact dates just planned; **Messages** shows the two notifications (click one to read it).

## 4:30 — The client side (Window B, phone width)

- Sign in as `client@vact.demo`.
- "Hafiz sees his whole picture: **2 of 6 approved**, one overdue, one pending, one where we asked for changes, one
  waiting for us."
- Tap the overdue **Annual return information** → tap the upload area, pick any PDF (the seeded sample files are in
  `uploads/`, or any PDF on the Mac) → progress bar → "Uploaded. V ACT will review it."
- Back on the dashboard it moved to **Waiting for V ACT**.
- Open **Proof of address** (changes requested): the staff comment is right there. Upload a corrected PDF → new version.

## 6:00 — Reminders stop by themselves (Window A)

- Open **Companies → Hafiz Trading → Requests** → **Open** on **Annual return information**. The box at the top now
  says "1 file ready for your review", and under **Reminders** every remaining one shows *Not needed*. "The moment he
  uploaded, the chasing stopped. The WhatsApp bot could not do this."
- Same page: the PDF preview is right there → **Approve** → **Approve and tell the client**. Phone buzzes: approved message.

## 7:00 — Review queue, request changes, upload on behalf

- **Review queue**: the waiting uploads are listed on the left and the oldest one is already open on the right, on the
  same page. Click TechNova Solutions, Bank statements → two files with an inline preview → **Ask for changes** →
  comment "October statement is missing page 2" → **Send to the client**. The queue moves straight on to the next upload.
- Window B (as Hafiz) is a different company, so just say: the TechNova director now sees that comment on his phone.
- Next in the list: Kedai Kopi Warisan, Management accounts was **uploaded by staff** (the client emailed it). Click it,
  show *(staff)* on the file, **Approve**. "Clients who will never log in are still covered."

## 8:00 — Run the scheduler live (Admin → Settings)

- **Settings** → the scheduler card shows the worker heartbeat. Two reminder jobs are deliberately due right now.
- Click **Run reminders now** → "2 sent". Phone buzzes a third time: the **Management accounts** reminder with
  `3 days left` filled in, and the matching email lands in your inbox. (If the send window is closed because it is after 18:00, the card says *held* — explain the window, then
  change the window end in the same screen to 23:00, save, run again.)

## 9:00 — Proof (Delivery log)

- **Delivery log**: filter company **Hafiz Trading**. Click **Details** on today's WhatsApp reminder: the exact text,
  the Meta message id, and the Queued → Sent → Delivered → Read timeline (with ngrok the ticks arrive live; without it,
  explain that receipts need the public URL that comes with hosting, and point at the simulated rows that show the
  full timeline).
- Click **Export CSV**: "If a client ever says 'you never told me', this is the file."
- Finish on **Audit log**: who did what, when.

## Questions they usually ask

- *Can clients see each other's companies?* No. Each login is linked to specific companies; file links are signed, expire
  in 10 minutes and are checked against the session. Show `rosli@hamidholdings.demo`, a director with two companies, if
  asked.
- *What if the number is wrong?* Puncak Hijau: the failed message shows Meta's reason, and the escalation told Daniel
  to call.
- *Who sends the WhatsApp?* For the demo, messages are simulated (the delivery log shows sent, delivered and read).
  For real use it is V ACT's own WhatsApp Business number on Meta's Cloud API, with the `vact_reminder` template approved.
- *What about public holidays?* Reminders skip weekends and Kuala Lumpur public holidays (Settings has the list, editable
  when the Islamic dates are announced).
- *What happens next?* The demo runs at `vact-portal.vercel.app`. For real use: V ACT's own domain, WhatsApp number and
  email domain, and import of the real client list. All provider settings are already environment variables.

## Reset between rehearsals

`pnpm db:reset && pnpm dev:all` puts everything back, including the sample files and the two jobs that are due now.

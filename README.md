# Event Invitations

Reusable, multi-event invitation platform for weddings, birthdays, memorials, corporate events, parties and more:

1. **Organiser** creates an event (type, title/hosts, date, venue, colours) and imports guests from CSV.
2. Each guest gets a **unique code via WhatsApp** (Meta Cloud API).
3. The **first device** to redeem a code is bound to it: the browser generates a non-extractable ECDSA P-256 key,
   signs a server challenge, and the public key is stored on the invite. Any other device is refused.
4. The bound guest can view and **download a QR pass** (a signed token — can't be forged).
5. Each door **staff** member gets a one-time WhatsApp link that binds their phone as a check-in scanner and walks them
   through using it. At the venue they open `/<slug>/verify` and scan QR passes or type codes to check guests in.

## Setup

```bash
cp .env.example .env   # fill in values — see comments in the file
npm install
npm run db:migrate     # applies prisma/migrations to DATABASE_URL (Neon)
npm run dev
```

Open `http://localhost:3000/admin` and sign in with `ADMIN_PASSWORD`.

With `WA_PROVIDER=console` invites are printed to the server log instead of being sent.

## Event types

Each event has a type (Wedding, Birthday, Memorial / Funeral, Corporate, Party, Other) that supplies the default
wording: the eyebrow above the title, the invitation line, and the calendar entry title. The eyebrow and
invitation line can be overridden per event. Presets live in `src/lib/event-kinds.ts`.

## WhatsApp (Meta Cloud API)

1. Create a WhatsApp Business app in Meta for Developers and add a phone number.
2. Create and get approval for a **template** (default name `event_invite`, changeable per event) whose body has
   four variables (guest name, event title, code, link), e.g.:

   > Hi {{1}}, you're warmly invited to {{2}}! Your personal invite code is {{3}}.
   > Open your invitation here: {{4}} — it will be locked to the first phone that opens it.

3. For scanner devices, a second template (default `scanner_link`, changeable per event) with four variables
   (staff name, event title, device label, link), e.g.:

   > Hi {{1}}, you're on the guest check-in team for {{2}} ({{3}}). Open this link on the phone you'll use at the
   > door to set it up: {{4}} — it only works on the first phone that opens it.

4. Set `WA_PROVIDER=meta`, `WA_TOKEN` (permanent system-user token), `WA_PHONE_NUMBER_ID`.
5. Delivery receipts (optional): point the webhook at `https://<host>/api/webhooks/whatsapp`, subscribe to
   `messages`, and set `WA_VERIFY_TOKEN` and `WA_APP_SECRET`.

### Client's own business account

Each event can send from the client's own WhatsApp Business number instead of the platform account above. On the
event's admin page, under **WhatsApp account**, enter the client's phone number ID and a permanent system-user access
token (and their app secret if they want delivery receipts). The client's account needs its own approved template
matching the event's template name and language. Events without an account fall back to the `WA_*` settings.

- Tokens and app secrets are encrypted at rest with `CREDENTIALS_SECRET` (AES-256-GCM) and never sent to the browser.
  Changing that secret means re-entering saved credentials.
- Delivery receipts: in the client's Meta app, set the callback URL and verify token shown on the event page
  (`https://<host>/api/webhooks/whatsapp/<eventId>`) and subscribe to `messages`.

## Device binding — how it works

| Step | Browser | Server |
| --- | --- | --- |
| 1 | generate/load ECDSA key in IndexedDB (private key non-extractable) | |
| 2 | `POST /api/claim/challenge {code}` | issue single-use nonce (2 min) |
| 3 | sign `wedding-invite-claim|code|nonce` (legacy prefix, kept stable) | |
| 4 | `POST /api/claim {code, nonce, signature, publicJwk}` | verify signature; bind key if unbound (atomic), else require the same key |
| 5 | | set a 12h session cookie pinned to that key |

Return visits repeat steps 2–5 silently. If a guest loses their device or clears browser data, the organiser
clicks **Reset device** on that guest; the old device loses access and the code can be claimed again.

### Scanner devices

Check-in phones use the same scheme. The organiser adds a device (staff name, WhatsApp number, label like "Gate A")
under **Scanner devices**; the staff member gets a link to `/<slug>/scanner?t=<token>` that walks them through
linking the phone, allowing the camera and how to scan. The browser signs `scanner-bind|deviceId|nonce` (a distinct
prefix, so guest-claim signatures can't be reused) via `/api/scanner/challenge` and `/api/scanner/bind`, and gets a
7-day session pinned to the key; afterwards the check-in page re-authenticates silently from the stored key.

- Unopened links expire after 7 days; **Resend link** issues a fresh one and kills the old one.
- **Remove** cuts a phone off immediately; **New phone** removes it and sends the same person a new link.
- Each check-in records which device made it. Admins can always use the check-in page.

## Tests

```bash
npm test   # unit tests + DB integration tests (integration runs when DATABASE_URL is set)
```

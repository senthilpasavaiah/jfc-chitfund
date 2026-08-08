# Jolly Friends Club — Chit Fund Management System

A full-stack chit fund management application: member records, chit lifecycle
(creation → monthly auctions → payouts → closure), payment tracking with late
fines and auction dividends, expense tracking, and role-based access for
Admins, Managers, Collectors, and Members.

This replaces the earlier single-file HTML prototype (`chit-fund-admin-prototype-mobile.html`),
which had no backend, no database, and only simulated OTP/notifications.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4, React Router
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (schema defined in `backend/prisma/schema.prisma`)
- **Auth:** JWT access tokens (15 min) + httpOnly refresh tokens (7 days, rotated on use)

## Project layout

```
jfc-chitfund/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # canonical data model (use this with `npx prisma migrate dev`
│   │   │                        on a machine with normal internet access)
│   │   ├── sql/001_init.sql   # hand-written equivalent, used in this sandbox (see note below)
│   │   └── seed.js            # creates an admin user + sample members/chit
│   └── src/
│       ├── config/            # db pool, logger
│       ├── middleware/        # auth, RBAC, error handling
│       ├── routes/            # one file per resource
│       ├── controllers/       # thin HTTP layer
│       ├── services/          # business logic (chit lifecycle, auctions, payments...)
│       ├── validators/        # express-validator rules
│       ├── utils/             # JWT, encryption, audit logging
│       └── __tests__/         # Jest unit + API tests
└── frontend/
    └── src/
        ├── api/client.ts      # axios instance with silent token refresh
        ├── context/           # auth context
        ├── components/        # app shell, route guard
        ├── pages/              # Login, Dashboard, Members, Chits, Chit detail, Expenses
        └── types/              # shared TS types matching the API
```

## A note on Prisma vs. raw SQL in this build

The `backend/prisma/schema.prisma` file is the **canonical, documented data
model** — it's what you should use going forward. In the sandbox this was
built in, `npx prisma generate` couldn't reach `binaries.prisma.sh` (blocked by
the sandbox's network allowlist — this is not a real-world limitation, just
this container). So the *running* backend in this build talks to Postgres
directly via `pg` (node-postgres), using `backend/prisma/sql/001_init.sql`,
which is a 1:1 SQL translation of the Prisma schema.

**To switch to Prisma properly** (recommended once you're outside this sandbox):
1. `cd backend && npx prisma generate`
2. `npx prisma migrate dev --name init` (on a *fresh* database — it will create its own migration history)
3. Replace the raw `pg` calls in `src/services/*.js` with `prisma.<model>.findMany(...)` etc. The schema field names map directly (e.g. `chit_value` → `chitValue`).

## Local setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Backend
```bash
cd backend
npm install
cp .env.example .env        # then edit DATABASE_URL, JWT secrets, FIELD_ENCRYPTION_KEY
psql -U postgres -c "CREATE DATABASE jfc_chitfund;"
psql -U postgres -d jfc_chitfund -f prisma/sql/001_init.sql   # or use Prisma migrate, see above
node prisma/seed.js          # creates admin: phone 9000000001 / password Admin@123
npm run dev                  # http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api to :4000)
```

### Both at once (this sandbox / a similar dev container)
```bash
bash dev-start.sh
```

## Default credentials (seeded)

| Role  | Phone       | Password    |
|-------|-------------|-------------|
| Admin | 9000000001  | Admin@123   |
| Manager | 9000000002 | Manager@123 |

**Change these before using this anywhere near real member data.**

## Module status

| Module | Status |
|---|---|
| Auth (login, logout, refresh, change/forgot/reset password, lockout) | ✅ Done, tested |
| Members (CRUD, search/filter/pagination, Aadhaar encryption, soft delete) | ✅ Done |
| Chit lifecycle (create → assign members → start → auction → close) | ✅ Done, tested |
| Auctions (winner, discount, commission, dividend calculation) | ✅ Done, tested |
| Payments (receipts, late fines, dividend netting, advance payments) | ✅ Done, tested |
| Expenses (office/misc tracking) | ✅ Done |
| Dashboard (KPIs, recent activity) | ✅ Done |
| Notifications (SMS/WhatsApp/Email/Push) | ⚠️ Logged only — see `NOTIFICATIONS.md` |
| RBAC (Admin/Manager/Collector/Member) | ✅ Done |
| Audit logging | ✅ Done |
| Rate limiting, input sanitization, security headers | ✅ Done |
| Unit + integration tests | ✅ 12 passing (auth, fines, encryption) — expand coverage as you add features |
| Member documents (upload/storage) | 🚧 Schema ready, no file storage wired up yet — needs a cloud storage decision (S3/Cloudinary/etc.) |
| Deployment (Vercel/Render/Railway) | 📄 See `DEPLOYMENT.md` — needs your hosting accounts |

## Security notes specific to this domain

- Aadhaar numbers are encrypted at rest with AES-256-GCM (`FIELD_ENCRYPTION_KEY` in `.env`) and only the last 4 digits are ever returned by the API.
- Passwords are hashed with bcrypt (12 rounds), accounts lock for 15 minutes after 5 failed logins.
- Every state-changing action (member/chit/payment/auction changes) is written to `audit_logs`.
- **Before going live:** generate a real `FIELD_ENCRYPTION_KEY` and JWT secrets (don't reuse the ones in `.env` — those are dev-only placeholders), and decide who administers the production database, since it will hold real members' Aadhaar numbers and payment history.

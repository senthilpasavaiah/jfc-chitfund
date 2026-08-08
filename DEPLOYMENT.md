# Deployment Guide

This app is built to deploy as: **frontend on Vercel, backend + database on
Render or Railway.** None of this can be done for you automatically — it
needs your accounts and, in most cases, a paid tier for a always-on Postgres
instance and backend service.

## 1. Database (Render or Railway)

Both offer managed Postgres with a free trial tier that expires/sleeps —
budget for a paid tier for anything you intend to keep running for JFC members.

1. Create a new Postgres instance.
2. Copy the connection string it gives you.
3. Run the schema against it:
   ```bash
   psql "<your-connection-string>" -f backend/prisma/sql/001_init.sql
   ```
   (Or, once you have full internet access outside this sandbox: `npx prisma migrate deploy` using that schema.prisma.)
4. Run the seed script once, pointed at production, to create your real admin account — then **immediately log in and change the password**.

## 2. Backend (Render or Railway)

1. Push this repo to GitHub.
2. Create a new Web Service pointing at `backend/`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment variables to set (do **not** reuse the dev values in `.env`):
   - `DATABASE_URL` — from step 1
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `FIELD_ENCRYPTION_KEY` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (32 bytes exactly)
   - `CORS_ORIGIN` — your deployed frontend URL
   - `NODE_ENV=production`

## 3. Frontend (Vercel)

1. Import the repo, set the root directory to `frontend/`.
2. Build command: `npm run build`, output directory: `dist`.
3. Environment: point the app's API base URL at your deployed backend (currently the dev proxy assumes same-origin `/api` — for production, either put the frontend and backend behind the same domain via a reverse proxy/rewrite, or update `frontend/src/api/client.ts`'s `baseURL` to the full backend URL and make sure `CORS_ORIGIN`/cookie settings on the backend match).

## 4. Before real members' data goes in

- [ ] Rotate every secret away from the checked-in dev `.env` values
- [ ] Confirm the database provider's backup policy meets your comfort level for financial records
- [ ] Decide who has production database access, and how that access is reviewed
- [ ] Read `NOTIFICATIONS.md` and decide on a provider before relying on reminders being sent
- [ ] Consider India's DPDP Act obligations around Aadhaar data — this is stored encrypted, but you're still the data fiduciary for JFC's members

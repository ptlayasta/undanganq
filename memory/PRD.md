# Undangan Digital — Product Requirements Document

## Problem Statement
White-label, Indonesia-first digital invitation SaaS. Users create beautiful digital invitations for weddings, aqiqah, birthdays, and corporate events, distribute personalized links via WhatsApp, and track RSVPs in real-time. Bahasa Indonesia UI, IDR pricing, freemium model.

## User Choices (from initial ask_human, 2026-02-08)
- Auth: **Emergent-managed Google Auth**
- Payments (Xendit) + WhatsApp (Twilio) → **MOCKED** for MVP
- Storage: **Emergent Object Storage** (real)
- Scope: full flow end-to-end with mocked payments/WA
- Routing: path-based `/inv/{slug}/{guest-slug}` (mocked subdomain, easy to swap for wildcard DNS at production)

## Personas
- **B2C organizer** — bride/groom, parents (aqiqah), individual celebrant
- **B2B planner** — wedding organizer managing multiple events

## What's Implemented (2026-02-08)
### Backend (`server.py`)
- Emergent Google OAuth (`POST /api/auth/session`, `GET /api/auth/me`, `POST /api/auth/logout`) with httpOnly cookie + Bearer header fallback
- Event CRUD: `POST/GET/PATCH/DELETE /api/events[/id]`
- 6 built-in templates across wedding/aqiqah/birthday/corporate categories
- Guest management: bulk add, delete, unique per-event slugs
- Public endpoints (no auth): `GET /api/public/inv/{slug}[?guest=...]`, `POST /api/public/inv/{slug}/{guest_slug}/rsvp`
- RSVP summary: `GET /api/events/{id}/rsvp/summary` with counts + headcount
- **MOCKED** Xendit checkout: `POST /api/events/{id}/checkout` → `POST /api/payments/{id}/complete`
- Free-tier publish: `POST /api/events/{id}/publish-free`
- **MOCKED** WhatsApp bulk: `POST /api/events/{id}/whatsapp/send`
- Emergent Object Storage: `POST /api/upload`, `GET /api/files/{id}` — real integration

### Frontend (React + Tailwind + Shadcn)
- Landing page with hero, bento features, pricing (Bahasa Indonesia)
- Dashboard with event list + status badges
- Template gallery with 4 tabs (Pernikahan / Aqiqah / Ulang Tahun / Korporat)
- Editor: accordion form on left, live mobile phone preview on right
- Guest management: single + CSV bulk import, copy personalized link, delete
- Publish page: free vs premium tier cards, Xendit MOCK dialog with QRIS/VA/GoPay/OVO/DANA
- Public invitation renderer (mobile-first, elegant, with music player)
- Public RSVP form (Hadir/Tidak Hadir + guest count + notes)
- RSVP dashboard with Recharts pie + bar + detail table

### Testing
- Backend: 20/20 tests pass (`/app/backend/tests/backend_test.py`)
- Frontend: 11/11 E2E flows pass via cookie-seeded MongoDB session

## Backlog
### P0 — Enable for production
- Real Xendit integration (replace mock in `checkout_event` / `complete_payment`)
- Real Twilio WhatsApp Business API (replace mock in `send_whatsapp_bulk`) + Meta template approval
- Wildcard DNS + subdomain routing (`{slug}.domain.com/{guest}`) — currently path-based
- Custom domain support for B2B

### P1 — Product polish
- Font/color customization in editor (currently theme comes from template only)
- Video upload + prewedding video section on invitation
- Google Calendar "Save the date" button
- Guest book / digital angpao QR
- Multi-language (English)

### P2 — Growth
- Template marketplace (community-created)
- AI-generated invitation copy suggestions
- Analytics: link opens, view duration, engagement
- Referral program

## Known Mocks (clearly labelled in UI)
- Xendit checkout dialog shows "MOCKED · Simulasi pembayaran Xendit"
- WhatsApp send toast shows "(MOCK)" prefix

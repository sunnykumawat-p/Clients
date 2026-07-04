# ClientPulse — Product Requirements Document

## Problem Statement (verbatim from user)
ClientPulse is a relationship-first CRM built for businesses with a handful of high-touch clients — freelancers, consultants, boutique agencies. Every action logged against a client must (1) update their timeline & current status, (2) surface or clear them from "Needs Attention Today", and (3) draft a ready-to-send WhatsApp message in their preferred language.

## User Persona
- **Single owner** — freelancer/consultant/agency owner managing 10-30 high-touch clients.
- Uses the app on both desktop (deep work) and mobile (between client visits).
- Speaks English + Hindi; clients too.

## Core Requirements (Tier 1 — MVP DONE)
- Single-owner JWT auth (email + password, seeded via env, no self-register).
- Client Master: name, phone, language (en/hi), source, stage, quoted value, notes.
- Client Profile "Memory" view: stage, money status (quoted/paid/outstanding), unified timeline, tasks, payments.
- "Needs Attention Today" dashboard: overdue follow-ups, going-quiet actives, overdue payments, tasks due.
- Message Template Library (7 categories × 2 languages, seeded).
- Auto-Draft WhatsApp with tap-to-send (wa.me deep-link, opens WhatsApp — user taps Send).
- Payment tracking per client (Cash/UPI/Bank Transfer) with running balance.
- Task/milestone tracker feeding attention dashboard.
- Editable stages, follow-up thresholds in Settings.
- Analytics: totals, pipeline, revenue this month, avg Lead→Signed, conversion by source & language.

## Golden Rule Implemented
Logging a payment → auto-opens WhatsApp draft with "Payment Received" template.
Completing a task → opens "Milestone Update" WhatsApp draft.
Changing stage → opens the correct template (Signed / Milestone / Proposal).
Dashboard rows have one-tap "Draft WhatsApp" for the matching category.

## Branding (per user request)
- "Made by Raj with Love using Emergent" in Cormorant Garamond italic — sidebar footer, login page, settings page, desktop footer.
- Support email `Sunnykumawat321@gmail.com` on Login, Settings, and desktop footer.

## What's Implemented (2026-02-04)
- ✅ Full backend: auth (login + **register + forgot-password + reset-password**), CRUD for clients / tasks / payments / templates / settings, dashboard, analytics.
- ✅ Signup, Forgot Password, Reset Password pages — new users can create their own workspace; password reset via in-app token (email out of scope).
- ✅ Seed: owner user, 14 templates (7 × en/hi), 15 realistic clients including Tuku's ZAARRAA (In Progress) and Sunshine Family Clinic (4-day-old Lead).
- ✅ Frontend: Login, Signup, Forgot/Reset, Dashboard (Needs Attention Today), Clients list, Client Profile (timeline / tasks / payments tabs), Templates, Analytics, Settings.
- ✅ WhatsApp draft modal with language toggle, template picker, wa.me deep link.
- ✅ Responsive: desktop sidebar, mobile bottom nav.
- ✅ Tagline updated to "Client Memory Studio"; signature updated to "Made by Raj with Love ❤️ using Emergent" everywhere.

## Backlog
### P1 — next iteration
- PDF quote/invoice export.
- Bulk stage-change actions and multi-select on Clients list.
- Simple tagging + filter chips on Clients list.
- Re-engagement view for Past clients (90+ days silent).

### P2
- Import clients from CSV.
- Recurring tasks / reminders.
- Automated re-engagement checks with template pre-fill.
- Optional client portal share link.

### P3
- WhatsApp Business API integration (paid) for true auto-send.
- Team seats / multi-user permissions.

## Owner Test Credentials
- Email: owner@clientpulse.app
- Password: pulse2026

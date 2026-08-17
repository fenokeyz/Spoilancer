# Spoilancer — Product Requirements Document

## Original problem statement
Build "Spoilancer" — a Smart Daily Finances Limiter mobile app with a dark, flowy
aesthetic (District-app-like). User sets a monthly stipend, defines per-day (Mon–Sun)
routine expense fields with upper limits + scheduled times, and the app enforces daily
accountability. Leftover from each daily limit becomes "spoilance" (a guilt-free splurge
balance) which can be moved to savings or spent. Includes: strict pre-home gate for
unlogged expenses, AI advisor, spoilance logger, history with monthly + all-time totals,
profile/settings/languages, local notifications, offline SMS parsing, and monthly reset.
Data is local-first (only login + AI analysis touch the network).

## Architecture
- **Frontend:** Expo (SDK 54) + expo-router, React Native, react-native-reanimated,
  @gorhom/bottom-sheet, react-native-keyboard-controller, expo-notifications,
  expo-blur/linear-gradient. Custom fonts: Fraunces (display) + Manrope (text).
- **Backend:** FastAPI + MongoDB (Motor). Handles ONLY: Emergent Google Auth
  (`/api/auth/session`, `/api/auth/me`, `/api/auth/logout`) and the AI Advisor
  (`/api/advisor/analyze`, Gemini 3 Flash via emergentintegrations + EMERGENT_LLM_KEY).
- **Local data:** All financial data on-device via `@/src/utils/storage` (`src/store/finance.ts`).
- **Design:** `/app/design_guidelines.json` — "6 Glass / Luxe DARK" personality.

## User personas
- Young professional / student on a fixed monthly stipend who wants to enforce limits on
  routine spends and consciously separate real savings from splurge money.

## Core requirements (static)
1. Google sign-in (Emergent) + offline guest mode.
2. Onboarding: stipend → per-day (Mon–Sun) expense fields (title, limit, description,
   time) with flowy progress bar + copy-previous-day → projected savings → spoilance allocation.
3. Strict pre-home gate: unlogged scheduled expenses (time passed) must be captured
   one-by-one before Home.
4. Home: Savings + Spoilance hero cards (editable, move spoilance→savings), today status,
   quick actions, spoilance-logger FAB.
5. Edit Daily Limits: day selector chips + CRUD expense templates.
6. AI Advisor: Gemini analysis of limits/spends/spoilance → structured suggestions.
7. Spoilance Logger: item-count-first → dynamic rows → live animated running total.
8. History: all-time savings/spoilance, current month, past-month snapshots, daily activity.
9. Profile + Settings: language selector, reminder management, wipe data, sign out.
10. Local reminders (per-field + 11pm catch-up). Offline SMS paste-to-parse. Monthly reset.

## Implemented (2026-06)
- ✅ Backend: Google auth session/me/logout + Gemini advisor (verified via curl).
- ✅ Auth context (Google + offline guest), routing bootstrap with monthly-reset check.
- ✅ Onboarding (9-step, progress bar, field editor, copy-day, summary math, spoilance).
- ✅ Strict gate (stacked pending capture, leftover→spoilance) — verified e2e.
- ✅ Home dashboard (animated money, hero cards, edit balances, move-to-savings, FAB).
- ✅ Edit Daily Limits (day chips + CRUD), reschedules reminders.
- ✅ Spoilance Logger (count stepper, dynamic rows, live animated total).
- ✅ AI Advisor screen (analysis, cached result, guest gating).
- ✅ History (all-time / month / snapshots / daily activity).
- ✅ Profile + Settings (language, reminders, wipe, sign out).
- ✅ Offline SMS parser (paste → extract amount → map to field → log).
- ✅ Local notifications scheduler; monthly reset & roll-forward logic.

## Backlog (prioritized)
- P1: Biometric/PIN app-lock on resume (handover P2).
- P1: Notification inline-reply capture + tap-to-gate deep link.
- P2: True background SMS auto-parsing (needs native build; Android only).
- P2: Grace-window month attribution UI for very-late entries.
- P2: Full i18n for selected languages (currently preference stored only).
- P2: Charts/visualisation in history.

## Next tasks
- Run comprehensive testing (backend + frontend offline flows), fix any issues.

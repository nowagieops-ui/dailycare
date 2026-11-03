# Mockup → app audit (2026-11-03)

The production app is built screen by screen from the mockup in the repo root.
Status: **Done** = matches mockup; **Partial** = exists but differs/incomplete; **Missing** = not built.
Family portal (8 screens) was removed by decision. Funding is removed from client screens by decision.

## Staff (DSP) app — 15 screens
| # | Mockup screen | Status | Gap |
|---|---|---|---|
| 1 | DSP-Login | Partial | Remember me, "New staff? Enter admin code" link, branding |
| 2 | DSP-ForgotPassword | Missing | |
| 3 | DSP-Onboarding (admin code) | Missing | Needs server-side code redemption |
| 4 | DSP-Home | Partial | Header avatar/bell/settings, "Hours this week", "Tasks due today", doc-to-sign card, training card |
| 5 | DSP-Schedule | Partial | Week strip, This week / Next week toggle, "In 20 min" status |
| 6 | DSP-ClockIn | Partial | Live clock, "Within range" indicator, missed-clock-in link |
| 7 | DSP-MissedClockIn | Done* | *wording/layout to match |
| 8 | DSP-Tasks (visit checklist) | Partial | Progress "2 of 5", visit notes + Submit (currently on Clock In tab) |
| 9 | DSP-Documents | Missing | Care plans (view), training, HR docs, sign-now |
| 10 | DSP-DocumentFill | Missing | |
| 11 | DSP-DocumentSign (PDF preview, e-sign) | Missing | |
| 12 | DSP-Training | Partial | Required-now, Competency / MD DDA / Agency-specific bands, credentials |
| 13 | DSP-Notifications | Missing | Inbox |
| 14 | DSP-Settings | Missing | Change password, push toggles, support links, log out |
| 15 | DSP-Chat | Missing | Team chat + agency announcements |

## Admin console — 19 screens (desktop sidebar layout in mockup)
| # | Mockup screen | Status | Gap |
|---|---|---|---|
| 1 | Admin-Login | Partial | Shares staff login; needs admin branding |
| 2 | Admin-ForgotPassword | Missing | |
| 3 | Admin-Dashboard | Missing | KPI tiles, recent activity, quick actions |
| 4 | Admin-Scheduling | Missing | Weekly grid, location filter, open shifts |
| 5 | Admin-AddShift | Done+ | Plus location, phone, alternating weeks, bulk upload |
| 6 | Admin-Staff (directory) | Partial | Table w/ status, certs, last clock-in |
| 7 | Admin-StaffDetail | Missing | Profile/Schedule/Documents/Attendance tabs |
| 8 | Admin-AddStaff | Partial | Start date, onboarding code generator |
| 9 | Admin-Clients | Partial | Table w/ assigned DSPs, care plan status (no Funding) |
| 10 | Admin-ClientDetail | Missing | ISP/Care plan, eBinder, Visit history, Care team |
| 11 | Admin-AddClient | Partial | DOB, guardian/contact |
| 12 | Admin-Compliance (eBinders) | Missing | Folders, versions, status, visibility |
| 13 | Admin-DocumentDetail | Missing | Signature status, audit trail |
| 14 | Admin-Training | Partial | Agency-wide training, completion bands, test library |
| 15 | Admin-Attendance | Missing | Timesheet table, approve/review, export |
| 16 | Admin-Reports | Missing | |
| 17 | Admin-Notifications | Missing | Inbox |
| 18 | Admin-AuditLog | Missing | |
| 19 | Admin-Settings | Missing | Agency profile, prefs, roles, lookup tables |

## Extra requirements from the owner (not in mockup)
Daily Notes tab; complete tasks+notes before clock-out; bulk shift upload; shift location + staff phone;
alternating-week recurrence; expiry reminders (3mo/2mo/1mo/1wk, repeating); admin announcements; training expiry alerts;
calendar sync; geofenced clock-in + leave-site alerts; super-admin file manager; multiple service lines; Family Staff role.
Built so far: all of the above except as noted in the tables.

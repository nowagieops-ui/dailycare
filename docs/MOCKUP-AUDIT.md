# Mockup → app audit (2026-11-03)

The production app is built screen by screen from the mockup in the repo root.
Status: **Done** = matches mockup; **Partial** = exists but differs/incomplete; **Missing** = not built.
Family portal (8 screens) was removed by decision. Funding is removed from client screens by decision.

## Staff (DSP) app — 15 screens
| # | Mockup screen | Status | Gap |
|---|---|---|---|
| 1 | DSP-Login | Done* | *Staff ID login not built (email only) |
| 2 | DSP-ForgotPassword | Done | |
| 3 | DSP-Onboarding (admin code) | Done | Server-side code redemption; admin generates codes in Staff |
| 4 | DSP-Home | Partial | Done except the "document needs your signature" card (needs Documents) and announcement→Chat link |
| 5 | DSP-Schedule | Done | |
| 6 | DSP-ClockIn | Done | Not yet tested on a real phone (needs device build) |
| 7 | DSP-MissedClockIn | Done* | *wording/layout to match |
| 8 | DSP-Tasks (visit checklist) | Done* | *Visit notes live on the separate Notes tab (owner request) |
| 9 | DSP-Documents | Partial | Training + shared files done; care plans (view) and HR docs/sign-now need the document system |
| 10 | DSP-DocumentFill | Missing | |
| 11 | DSP-DocumentSign (PDF preview, e-sign) | Missing | |
| 12 | DSP-Training | Partial | Required-now, Competency / MD DDA / Agency-specific bands, credentials |
| 13 | DSP-Notifications | Done | Inbox filled by Cloud Functions |
| 14 | DSP-Settings | Partial | Done except Contact the office, Privacy policy, Terms (need content from owner) |
| 15 | DSP-Chat | Missing | Team chat + agency announcements |

## Admin console — 19 screens (desktop sidebar layout in mockup)
| # | Mockup screen | Status | Gap |
|---|---|---|---|
| 1 | Admin-Login | Done | Web shows admin console branding |
| 2 | Admin-ForgotPassword | Done | Same screen as staff |
| 3 | Admin-Dashboard | Missing | KPI tiles, recent activity, quick actions |
| 4 | Admin-Scheduling | Missing | Weekly grid, location filter, open shifts |
| 5 | Admin-AddShift | Done+ | Plus location, phone, alternating weeks, bulk upload |
| 6 | Admin-Staff (directory) | Partial | Table w/ status, certs, last clock-in |
| 7 | Admin-StaffDetail | Missing | Profile/Schedule/Documents/Attendance tabs |
| 8 | Admin-AddStaff | Partial | Onboarding code generator done; start date, Case Manager role missing |
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

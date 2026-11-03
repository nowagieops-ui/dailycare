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
| 4 | DSP-Home | Done | Signature card and announcement link added |
| 5 | DSP-Schedule | Done | |
| 6 | DSP-ClockIn | Done | Not yet tested on a real phone (needs device build) |
| 7 | DSP-MissedClockIn | Done* | *wording/layout to match |
| 8 | DSP-Tasks (visit checklist) | Done* | *Visit notes live on the separate Notes tab (owner request) |
| 9 | DSP-Documents | Done | Care plans (view only), credentials, HR docs with Review & Sign |
| 10 | DSP-DocumentFill | Done | Typed documents; admin writes the text |
| 11 | DSP-DocumentSign (PDF preview, e-sign) | Done* | *Typed-name e-signature with server timestamp; no real PDF yet (needs Storage); no IP capture |
| 12 | DSP-Training | Done* | *No "Start training" content; the office records completion |
| 13 | DSP-Notifications | Done | Inbox filled by Cloud Functions |
| 14 | DSP-Settings | Partial | Contact the office done (uses agency phone). Privacy policy and Terms need content from owner |
| 15 | DSP-Chat | Done | Direct and group chats, announcements; push has no message text |

## Admin console — 19 screens (desktop sidebar layout in mockup)
| # | Mockup screen | Status | Gap |
|---|---|---|---|
| 1 | Admin-Login | Done | Web shows admin console branding |
| 2 | Admin-ForgotPassword | Done | Same screen as staff |
| 3 | Admin-Dashboard | Done | |
| 4 | Admin-Scheduling | Done* | *Filter is by service line (no separate locations yet) |
| 5 | Admin-AddShift | Done+ | Plus location, phone, alternating weeks, bulk upload |
| 6 | Admin-Staff (directory) | Done | |
| 7 | Admin-StaffDetail | Done* | *Documents tab lists document-type credentials only |
| 8 | Admin-AddStaff | Partial | Start date done; Case Manager role not built |
| 9 | Admin-Clients | Done | |
| 10 | Admin-ClientDetail | Partial | eBinder tab is a placeholder (docs are not linked to clients yet) |
| 11 | Admin-AddClient | Done | |
| 12 | Admin-Compliance (eBinders) | Done* | *Typed documents; PDF upload needs Storage |
| 13 | Admin-DocumentDetail | Done | |
| 14 | Admin-Training | Done* | *Test library (iManage integration) not built |
| 15 | Admin-Attendance | Done | CSV export instead of payroll integration |
| 16 | Admin-Reports | Partial | Attendance, on-time, utilization, credentials; no eBinder-by-folder or training % yet |
| 17 | Admin-Notifications | Done | |
| 18 | Admin-AuditLog | Done* | *Server-written; records what happened, not which admin did it |
| 19 | Admin-Settings | Partial | Agency profile, own prefs, roles table, service lines; lookup tables are fixed, not editable |

## Extra requirements from the owner (not in mockup)
Daily Notes tab; complete tasks+notes before clock-out; bulk shift upload; shift location + staff phone;
alternating-week recurrence; expiry reminders (3mo/2mo/1mo/1wk, repeating); admin announcements; training expiry alerts;
calendar sync; geofenced clock-in + leave-site alerts; super-admin file manager; multiple service lines; Family Staff role.
Built so far: all of the above except as noted in the tables.

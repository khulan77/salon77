# Responsive audit and booking themes — before / after

Screenshots at 360, 768 and 1280 px, produced by
`tests/browser-integration/responsive-audit.spec.ts`:

```bash
SALON77_AUDIT=<label> bunx playwright test --config .audit-playwright.config.ts
# reuse an integration server that is already running on 32178:
SALON77_AUDIT=<label> AUDIT_REUSE=1 PHASE2_PORT=32178 bunx playwright test --config .audit-playwright.config.ts
```

Checks per view: horizontal page overflow, visible controls smaller than
44×44 px (links inside running text are exempt), text clipped without an
ellipsis, and tables wider than the screen outside a scrolling container.

| Folder          | What it is                                                                         |
| --------------- | ---------------------------------------------------------------------------------- |
| `before/`       | first audit, before the earlier theme/responsive pass                              |
| `after/`        | result of that earlier pass (themes added)                                         |
| `polish-before/`| state before this polish pass (non-booking pages; the run stopped at the theme step)|
| `polish-after/` | first full run of this pass: 30 of 54 views with findings                          |
| `final/`        | after all fixes: **54 views, 0 findings** (`final/audit.json`)                     |

## Differences fixed in this pass

| Where | Before | After |
| --- | --- | --- |
| Booking page, Dark theme | «2 салбар» chip pale on pale (hard-coded purple) | theme tokens: accent on accent-soft, ≥ 4.5:1 |
| Booking page, Gold/Pink/Natural | tick on the selected branch nearly invisible | tick and ring in the theme accent |
| Booking page, all themes | address/hours/phone icons sat on their own line above the text | icon centred on the same line |
| Booking page, all themes | light strip between the themed page and the footer | themed background meets the footer |
| Booking page, all themes | every theme had the same shape and type | per-theme radius (Pink 22px … Gold 8px) and Gold serif headings; gradient cover in theme colours when there is no photo |
| Settings, theme picker | one tiny card per theme; 4 + 1 wrap; radio names included preview text («Салон Үйлчилгээ … Цайвар») | miniature booking page per theme, hint («Үсчин, барбер» …), «Санал болгож буй» by service types, «Хуудсаа харах» link; 3 columns on desktop, 2 on phone; radio name is the theme name |
| Public footer (all public pages) | links 40 px tall, «Үнэ» 24 px wide | 44 × 44 px minimum |
| Admin calendar/bookings, 360 px | date row broke as «Өнөөдөр ‹ date» / «› 📅 ⟳» | «‹ date ›» on one line, «Өнөөдөр … 📅 ⟳» below; all 44 × 44 |
| Audit | `sr-only` text reported as clipped | screen-reader-only text excluded |

Admin tables and the day grid already scroll inside their own panels at
360 px (no page overflow), so they were left as is.

## Update: admin desktop restored to the original compact layout

The earlier pass applied 44 px to every admin button at every width. That
pushed the calendar's whole-day grid and the 31-day timesheet off the screen
(clipped customer names, days 28–31 hidden, footer covering the grid), and
`MIN_PX_PER_MINUTE` had been raised from 0.7 to 1.5. Now:

- 44 px admin targets apply on touch screens and windows ≤ 1024 px only
  (`@media (pointer: coarse), (max-width: 1024px)` in `app/responsive.css`);
  calendar cards and timesheet cells stay compact everywhere.
- `MIN_PX_PER_MINUTE` is back to 0.7, so the whole day fits the window again.
- The audit checks 44 px at 360/768 and WCAG 2.5.8's 24 px at 1280. At 1280 the
  remaining findings are the original desktop design, kept on purpose: the
  calendar's half-hour slots (21 px tall, so the day fits) and a few 23 px icon
  buttons.

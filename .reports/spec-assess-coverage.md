# Spec coverage — questionnaire-sessions-answering

**Date:** 2026-08-17  
**Suite:** `src/lib/sessions.test.ts`, `src/lib/askmeatsack-tool.test.ts`, `src/lib/app-sessions.test.ts` (59 tests after metadata case)

## Behaviours

| ID | Badge | Verdict | Evidence |
| --- | --- | --- | --- |
| B1 | 🟡 | Covered (HTTP/tool create) | `sessions.test.ts` F2.T1/T2; `askmeatsack-tool.test.ts` |
| B2 | 🟢 | Partial | Public view F1.T1; page walked in C3/C4, no component harness |
| B3 | 🟢 | Covered | F1.T5, F1.T10 |
| B4 | 🟢 | Covered | in_progress after save; tool status test |
| B5 | 🟢 | Covered | F1.T7 freeze + resubmit |
| B6 | 🟢 | Covered | F1.T8; required text |
| B7 | 🟢 | Covered | Tool vs HTTP after submit; F2.T3 via poll |
| B8 | 🟢 | Covered | F1.T3, F1.T9, F2.T4, read window |
| B9 | 🟢 | Covered | F1.T6, F1.T14 variants |
| B10 | 🟡 | Covered (non-email) | Create key, public vs agent tokens |
| B11 | 🟢 | Covered | F1.T4 submitted_view |
| B12 | 🟢 | Covered | F1.T2, unknown id, junk cancel |
| B13 | 🟢 | Covered | F2.T7–T10, over-max, public cannot wait |
| B14 | 🟢 | Partial | F1.T12 markOpened; HTML GET not setting opened is app-path, not a unit test |
| B15 | 🟢 | Covered | Recommended refused if invalid; not preselected |
| B16 | 🟢 | Covered | F1.T13 text; comment on choice |
| B17 | 🟢 | Covered | F1.T15, F2.T11/T12, F1.T11 |
| B18 | 🟢 | Covered | Submit/expiry/cancel callback; failing callback; invalid URL |
| B19 | 🟢 | Covered | Download after submit; refused while open |
| B20 | 🟢 | Partial | Tool name test; skill file has no automated test (write-tests: do not test markdown) |
| B21 | 🔵 | Uncovered | Expected |

## Flow guards (both branches)

| ID | Happy | Other branch |
| --- | --- | --- |
| F1.T1–T15 | Covered except T12 GET-vs-POST opened (Partial) | T6/T8/T9/T14 refusal branches covered |
| F2.T1/T2 | Covered | Covered |
| F2.T3–T12 | Covered | T12 both submit and expiry |
| F2.T13/T14 | Uncovered | Expected (B21) |

## 🟢 without a covering test

- **B20** — skill artefact, not a runtime assertion. Leave the badge; do not add a markdown test.
- **B2 / B14 UI** — no presentational harness; walked in the running app during C chunks.

## Contradictions

_None._ Invalid callback URL is refused as `invalid_questions` (schema fail). Spec does not name that error code; outcome matches.

## Recommended order

1. E1 email tests for F2.T13/T14 when Resend is provisioned.
2. Optional: markdown prompt rendering if that invariant is kept as 🟢-enforced.
3. Do not add page-mock tests for B2/B14.

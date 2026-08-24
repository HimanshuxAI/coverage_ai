# Final Interaction Matrix

Verified on August 24, 2026 from `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/cases/[caseId]/page.tsx`, helper modules under `src/lib`, the Task 2-4 hardening reports, and fresh read-only route checks. This matrix describes the hardened repository state and should be checked against production after each deployment.

## Route Summary

| Surface | Route | Purpose | Backing data |
| --- | --- | --- | --- |
| Landing | `/` | Product narrative and entry CTAs | Static page copy and canvas effects |
| Dashboard | `/dashboard` | Operations snapshot, health, queue, and entry into case detail | Supabase `cases` read plus `/api/health` |
| Command center | `/dashboard/cases/[caseId]` | Aggregate-backed case, workflow, audit, and packet view | `/api/cases/[caseId]` aggregate envelope |

## Landing

| Visible control or element | Action | Target / route | Data source | Visible states / notes |
| --- | --- | --- | --- | --- |
| Top-right link `OPEN COVERAGE TWIN ↗` | Navigate | `/dashboard` | Static | Primary product entry point |
| Case rail horizontal area | Scroll / swipe | In-page | Static | Rail is explicitly labeled as horizontally scrollable |
| Rail CTA `Open the live dashboard` | Navigate | `/dashboard` | Static | Added as the rail-level meaningful CTA |
| Protocol CTA `OPEN THE PRODUCT` | Navigate | `/dashboard` | Static | Meaningful product link |
| Closing CTA `Launch Coverage Twin` | Navigate | `/dashboard` | Static | Mobile-visible final CTA |
| Lifecycle section | Read-only | In-page | Static | Shows all six workflows: Intake, Pre-auth, Re-evaluate, Discharge, Settlement, Appeal |
| Evidence rail | Read-only | In-page | Static | Shows Policy, Clinical, Financial, Human proof categories |

## Dashboard

| Visible control or element | Action | Target / route | Data source | Visible states / notes |
| --- | --- | --- | --- | --- |
| Header anchors `OPERATIONS`, `CASES`, `SYSTEM` | Jump to section | `#operations`, `#cases`, `#system` | Static anchors | No dead header labels remain in the hardened local page |
| Snapshot badge | Status only | None | `getSnapshotIndicator()` + `/api/health` + case read result | `LOADING SNAPSHOT`, `SNAPSHOT UNAVAILABLE`, `SNAPSHOT DEGRADED`, `SNAPSHOT AVAILABLE` |
| `REFRESH SNAPSHOT` button | Re-read dashboard snapshot | Same page | Supabase `cases` and `/api/health` | Label changes to `REFRESHING...` while busy |
| `+ NEW CASE / SEED DEMO` button | POST seed route, then refresh snapshot on success | `/api/workflow/seed` | Seed route response + fresh dashboard reads | Shows success/error feedback message |
| Operations metrics | Read-only | None | `calculateDashboardMetrics(cases)` | Active Cases, Decision Ready, Authorised, Exceptions |
| Featured case card CTA | Navigate | `/dashboard/cases/[caseId]` | Filtered case list | Hidden when no featured case exists |
| System state panel | Read-only | None | `/api/health` | Shows snapshot status, DB configured/missing, DB reachable/unavailable, workflow config presence, snapshot time |
| Search input | Filter queue | Same page | Loaded `cases` snapshot | Matches case ID, member, policy, hospital, diagnosis, procedure, raw status, and presented status label |
| Sort select | Reorder queue | Same page | Loaded `cases` snapshot | `Updated: Newest First`, `Updated: Oldest First`, `Case ID: A-Z`, `Status: A-Z` |
| Status filter toolbar | Filter queue | Same page | Loaded `cases` snapshot | `All`, `Active`, `Decision Ready`, `Authorised`, `Exception`; each shows count |
| Queue row link / `OPEN →` | Navigate | `/dashboard/cases/[caseId]` | Loaded `cases` snapshot | Whole row is clickable |
| Queue container | Status only | None | Dashboard read state | `Loading current case snapshot...`, cases-read failure message, zero-cases message, no-match message, or queue grid |
| Lifecycle architecture panel | Read-only | None | Static | Snapshot explainer, not an active control |

## Command Center

| Visible control or element | Action | Target / route | Data source | Visible states / notes |
| --- | --- | --- | --- | --- |
| `← BACK TO OPERATIONS` link | Navigate | `/dashboard` | Static | Hidden in print |
| Header status badge | Status only | None | Aggregate load state + `getCommandCenterStatusPresentation()` | `LOADING`, `NO RECORD`, `UNAVAILABLE`, `STALE SNAPSHOT`, or the current case status label |
| Copy buttons beside case/member/policy/provider | Copy safe identifiers | Clipboard | Aggregate case DTO | Only safe identifier fields are copyable |
| Aggregate refresh button | Re-read aggregate snapshot | Same page via `GET /api/cases/[caseId]` | Aggregate API | Labels: `REFRESH AGGREGATE`, `RETRY AGGREGATE FETCH`, `REFRESHING AGGREGATE...` |
| Primary process button | Submit next workflow request | `POST /api/cases/[caseId]/process` | Current status presentation + process route contract | Only renders when `canRenderProcessAction(...)` is true |
| Top-level error banner | Status only | None | Aggregate read / process error | Shows current error message without mutating live state |
| Metrics strip | Read-only | None | Aggregate-backed summary strip: evidence report count reads `evidenceReports`, recommended benefit reads `latestDecision`, current stage reads status presentation, and case version reads `case.caseVersion` | Evidence Reports, Recommended Benefit, Current Stage, Case Version |
| Canonical state panel | Read-only | None | Aggregate case DTO | Member, Policy, Clinical, Provider, Case Timing, Evidence Provenance cards |
| Decision basis panel | Read-only | None | `latestDecision`, `resolutionGraph`, `pendingApproval` | Shows persisted decision, support factors, and governance state |
| `LIVE UPDATE INTERRUPTED` banner | Status only | None | Poll controller state | Appears when a background aggregate refresh fails but last good snapshot is retained |
| Workflow run cards | Open or switch inspector | Same page | `workflowRuns` view model | Semantic buttons with `aria-pressed`; each card shows workflow name, key, status, updated time, and proof strip |
| Inspector `CLOSE` button | Close inspector | Same page | Selected workflow-run state | Also closable via Escape key |
| Inspector copy buttons | Copy run identifiers | Clipboard | Selected workflow-run inspector | Safe fields only: local run ID, Yoxa execution ID, idempotency key |
| Audit trail list | Read-only | None | `auditEvents` | Shows time, event type, actor |
| Packet action link | Open packet PDF in new tab | Sanitized `latestPacket.pdfUrl` | Aggregate packet DTO | Renders only when the stored URL parses safely as `https:` or a root-relative path |
| Packet fallback state | Status only | None | Aggregate packet DTO | `PACKET RECORDED WITHOUT PDF`, `NO PACKET RECORD`, or aggregate load-state fallback |

## Dashboard Status Vocabulary

| Area | Values grounded in code |
| --- | --- |
| Snapshot badge | `LOADING SNAPSHOT`, `SNAPSHOT UNAVAILABLE`, `SNAPSHOT DEGRADED`, `SNAPSHOT AVAILABLE` |
| Queue filters | `All`, `Active`, `Decision Ready`, `Authorised`, `Exception` |
| Health rows | `CONFIGURED` / `MISSING`, `REACHABLE` / `UNAVAILABLE`, `PRESENT` / `MISSING`, with `LOADING` and `STATUS UNAVAILABLE` fallbacks when `/api/health` is unavailable |
| Snapshot time row | `/api/health` timestamp when present; otherwise `LOADING` or `STATUS UNAVAILABLE` |

## Command-Center Status Vocabulary

| Area | Values grounded in code |
| --- | --- |
| Load state | `loading`, `ready`, `stale`, `noRecord`, `error` |
| Case status labels | `WAITING FOR ACTIVATION`, `ACTIVATED & VALIDATED`, `RESOLVING EVIDENCE`, `DECISION READY`, `HUMAN REVIEW REQUIRED`, `HUMAN AMBIGUITY`, `AUTHORISED`, `CLARIFICATION REQUESTED`, `DECLINED / REDUCED`, `DISCHARGE PENDING`, `SETTLEMENT PENDING`, `APPEAL OPEN`, `ATTENTION REQUIRED` |
| Next-action labels | `START INTAKE`, `RUN PRE-AUTH`, `RE-EVALUATE CASE`, `GENERATE DECISION PACKET`, `OPEN YOXA REVIEW`, `PROCESS DISCHARGE`, `SUBMIT CLARIFICATION`, `FILE APPEAL`, `SETTLE BILL`, `RESOLVE APPEAL`, `RETRY WORKFLOW` |
| Packet truth | `OPEN PACKET PDF` when `pdfUrl` is safely renderable; otherwise no packet action |

## Out Of Scope

Phase D / HITL work is not part of this matrix. The presence of the status text `OPEN YOXA REVIEW` in the presentation mapper does not mean this hardening task implemented new native human-approval controls, webhook resume flows, or any new production workflow orchestration.

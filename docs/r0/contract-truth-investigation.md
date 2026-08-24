# Coverage Twin R0 Contract and Truth Investigation

Date: 2026-08-24

Scope: reproduce and document the defects named in the R0 repair request before production changes. Phase C behavior is explicitly out of scope.

## Verified runtime contracts

`GET /api/cases/CASE-CT-REAL-001` currently returns:

```json
{
  "success": true,
  "data": {
    "case": { "case_id": "CASE-CT-REAL-001", "current_case_status": "AUTHORISED_BY_HUMAN" },
    "status": "AUTHORISED_BY_HUMAN",
    "workflowRuns": [],
    "evidenceReports": [],
    "resolutionGraph": null,
    "latestDecision": { "outcome": "AUTHORISE", "authorised_amount": 85000 },
    "latestPacket": { "packet_id": "PKT-CASE-CT-REAL-001-V1" },
    "pendingApproval": null,
    "auditEvents": []
  }
}
```

The nested rows still use database snake_case. The envelope and aggregate section names use camelCase.

`POST /api/cases/CASE-CT-REAL-001/process` currently reads:

```json
{ "workflowKey": "intake | preauth | materialChange | discharge | settlement | appeal" }
```

The current UI instead sends `{ "action": "..." }`. The route ignores that field and falls back to a status-derived workflow, including a default to `intake`. An invalid live request was deliberately not sent because the current behavior could invoke Yoxa.

## Defect ledger

### 1. Aggregate envelope mismatch

- EXPECTED: the command center stores the `CaseAggregate` inside the successful API envelope.
- ACTUAL: the route returns `{ success, data }`, but the page stores the entire JSON object and reads it as a flat case.
- ROOT CAUSE: the API was wrapped without changing the page model or unwrapping logic.
- SMALLEST FIX: define `ApiEnvelope<T>` and `CaseAggregate`; validate `json.success`; store `json.data` only.

### 2. Database/API/UI naming drift

- EXPECTED: snake_case ends at the API mapping boundary; API and frontend use camelCase.
- ACTUAL: aggregate section names are camelCase, nested rows remain snake_case, and the page guesses unrelated names such as `workflow_runs`, `execution_state`, and `decision_packet`.
- ROOT CAUSE: there is no explicit DTO mapper.
- SMALLEST FIX: add one database-row-to-API mapper and consume only its camelCase DTOs.

### 3. Selected workflow is ignored

- EXPECTED: the action selected by the UI is sent as a canonical registry key.
- ACTUAL: the UI sends `action`; the route reads `workflowKey`.
- ROOT CAUSE: request-body contract drift.
- SMALLEST FIX: create and test a request-body builder that emits `{ workflowKey }`; make the route parse only that contract.

### 4. Invalid workflow keys can reach orchestration

- EXPECTED: missing or invalid keys return `400 INVALID_WORKFLOW_KEY` before persistence or Yoxa calls.
- ACTUAL: the route trusts `body.workflowKey`; missing values fall back to status mapping and unknown statuses default to `intake`.
- ROOT CAUSE: runtime input is asserted as `YoxaWorkflowKey` without validation.
- SMALLEST FIX: validate against the registry key set before creating a Supabase client or workflow run; remove implicit route selection.

### 5. Workflow-run fields are imaginary in the UI

- EXPECTED: UI reads `status`, `yoxaExecutionId`, and persisted timestamps from the API DTO.
- ACTUAL: UI reads `execution_state` and `yoxa_workflow_run_id`; the drawer shows no timestamps.
- ROOT CAUSE: UI was authored against an assumed model rather than `workflow_runs` schema.
- SMALLEST FIX: normalize `WorkflowRunRecord` into a camelCase DTO and render its real fields.

### 6. Dashboard metrics are fabricated

- EXPECTED: zero live records produces zero; read failure produces unavailable state.
- ACTUAL: `realCount || 3` and `realCount || 1` replace valid zero values with demo counts.
- ROOT CAUSE: presentation defaults were embedded in operational calculations.
- SMALLEST FIX: extract and test pure metric calculation; never apply presentation fallback to counts.

### 7. Dashboard health is fabricated

- EXPECTED: labels distinguish database reachability from Yoxa configuration presence.
- ACTUAL: fetch failure becomes `healthy`; the panel hard-codes connected, healthy, deployed, recording, and governance claims.
- ROOT CAUSE: fetched health data is stored but not rendered.
- SMALLEST FIX: define a health DTO, render only database reachability and per-workflow configuration, and show unavailable when fetch fails.

### 8. Dashboard is mislabeled live/real-time

- EXPECTED: a once-fetched view is described as a current snapshot.
- ACTUAL: copy says live infrastructure and the prior plan calls the metrics real-time.
- ROOT CAUSE: marketing copy does not match refresh behavior.
- SMALLEST FIX: rename the panel to `CURRENT SYSTEM STATE` and expose snapshot time; do not add Phase C polling.

### 9. Command-center domain state is mostly demo content

- EXPECTED: available case, decision, evidence, graph, packet, audit, and run data is rendered from the aggregate.
- ACTUAL: header details, amounts, domain findings, recommendation, factors, governance, timeline fallback, audit entries, and packet state contain hard-coded successful values.
- ROOT CAUSE: the page stayed in prototype mode after the aggregate API was introduced.
- SMALLEST FIX: bind each section to the aggregate and render explicit `Unavailable` or `No persisted record` states.

### 10. Decision factors are unsupported

- EXPECTED: every factor cites a persisted decision, graph, or evidence report.
- ACTUAL: coverage, necessity, provenance, and tariff claims are unconditional strings.
- ROOT CAUSE: presentation narrative is treated as backend evidence.
- SMALLEST FIX: show the persisted human decision reason, graph reason codes, and evidence report statuses only.

### 11. Evidence count is unsupported

- EXPECTED: count equals returned evidence reports/artifacts.
- ACTUAL: UI always claims four verified artifacts.
- ROOT CAUSE: demo fixture leaked into live state.
- SMALLEST FIX: render `evidenceReports.length` as persisted reports and show document provenance separately.

### 12. Related-query failures are silently converted to no data

- EXPECTED: query failure differs from an empty successful result.
- ACTUAL: the aggregate route drops all six related-query `error` values and substitutes `[]`/`null`.
- ROOT CAUSE: `Promise.all` destructures data only.
- SMALLEST FIX: preserve named query results, classify all six judge-facing reads as required, and return `502 AGGREGATE_READ_FAILED` with failed source names.

### 13. Environment configuration is not validated at use time

- EXPECTED: server-critical workflow secret and URL fail clearly when the workflow is invoked.
- ACTUAL: `env.ts` is a defaults object and the server/client Supabase factories insert dummy build keys.
- ROOT CAUSE: build-time compatibility and runtime validation are conflated.
- SMALLEST FIX: add small use-time validators for workflow definitions; keep build-safe public configuration behavior unchanged in R0.

### 14. Lint is not clean

- EXPECTED: `npm run lint` passes.
- ACTUAL: 44 errors and 16 warnings. Product-code failures include `any`, hook ordering/dependencies, unused state, and unescaped text. Many additional errors come from Deno edge functions even though TypeScript build excludes them.
- ROOT CAUSE: ESLint scope is broader than the application TypeScript scope, plus new product UI code is not lint-clean.
- SMALLEST FIX: fix all application/landing errors; align lint ignores with the intentional `supabase/functions` TypeScript exclusion rather than disabling rules.

### 15. Working tree is not release-ready

- EXPECTED: product changes, generated artifacts, noise, and deletions are understood.
- ACTUAL: 10 modified entries, 16 untracked entries, and 9 deleted tracked OpenAPI files.
- ROOT CAUSE: several development passes were never normalized into a clean change set.
- SMALLEST FIX: preserve user product work; classify only. `.DS_Store` entries are accidental noise, `next-env.d.ts` is generated, `.omx/` is tooling state. OpenAPI deletions reflect a move toward workflow-scoped specs, but several flat specs have no one-to-one replacement and remain a packaging gap; do not restore or delete them during R0.

## Command-center field source matrix

| UI field | Source after repair | Classification |
|---|---|---|
| Case ID, member, policy, provider, diagnosis, procedure, stage, version | `aggregate.case` | LIVE |
| Human outcome, amount, reviewer, reason, decision time | `aggregate.latestDecision` | LIVE or explicit no record |
| Workflow ID/key/status/Yoxa ID/timestamps | `aggregate.workflowRuns` | LIVE or explicit no runs |
| Evidence count/status/provenance | `aggregate.evidenceReports` and `aggregate.case.documentProvenance` | LIVE |
| Graph state/reason codes | `aggregate.resolutionGraph` | LIVE or explicit no graph |
| Audit event/time | `aggregate.auditEvents` | LIVE or explicit no events |
| Packet ID/version/time | `aggregate.latestPacket` | LIVE or explicit no packet |
| Section titles, explanatory labels | component copy | STATIC LABEL |
| Friendly procedure display metadata | `demoPresentationData` only when explicitly labeled demo | PRESENTATION FALLBACK |
| Workflow state, health, audit, decision, approval, completion | never presentation data | LIVE ONLY |

## Repository/OpenAPI conclusion

The workflow-scoped OpenAPI directories added in later commits supersede the flat organization. `store-human-outcome.openapi.yaml` has an exact scoped replacement. Other deleted files correspond conceptually to Next route rewrites and workflow tools but do not all have exact scoped replacements. Their deletion is likely intentional reorganization, yet incomplete as an exported OpenAPI package. R0 will leave those deletions untouched and report them as an unresolved repository-packaging risk.

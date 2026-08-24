/* ======================================================
   YOXA — Resolution Graph Builder
   Merges specialist evidence into versioned dependency graph
   ====================================================== */

import type {
  DependencyNode,
  GraphState,
  EvidenceReport,
  PolicyFindings,
  ClinicalFindings,
  CostContractFindings,
} from "@/types/workflow";

export interface GraphBuildInput {
  case_id: string;
  case_version: number;
  policy_evidence: EvidenceReport;
  clinical_evidence: EvidenceReport;
  cost_contract_evidence: EvidenceReport;
}

export interface GraphBuildResult {
  graph_state: GraphState;
  dependency_nodes: DependencyNode[];
  unresolved_dependencies: string[];
  post_authorisation_conditions: string[];
  state_reason_codes: string[];
  next_safe_action: string;
  source_report_versions: Record<string, string>;
}

export function buildResolutionGraph(input: GraphBuildInput): GraphBuildResult {
  const nodes: DependencyNode[] = [];
  const unresolved: string[] = [];
  const postAuthConditions: string[] = [];
  const reasonCodes: string[] = [];

  const policyFindings = input.policy_evidence.findings as PolicyFindings;
  const clinicalFindings = input.clinical_evidence.findings as ClinicalFindings;
  const costFindings = input.cost_contract_evidence.findings as CostContractFindings;

  // ─── Check for tool failures ───
  if (
    input.policy_evidence.tool_status !== "SUCCESS" ||
    input.clinical_evidence.tool_status !== "SUCCESS" ||
    input.cost_contract_evidence.tool_status !== "SUCCESS"
  ) {
    reasonCodes.push("SPECIALIST_TOOL_FAILURE");
    return {
      graph_state: "TOOL_FAILURE",
      dependency_nodes: nodes,
      unresolved_dependencies: ["SPECIALIST_EVIDENCE_INCOMPLETE"],
      post_authorisation_conditions: [],
      state_reason_codes: reasonCodes,
      next_safe_action: "RETRY_EVIDENCE_RESOLUTION",
      source_report_versions: buildSourceVersions(input),
    };
  }

  // ─── Build policy dependency nodes ───
  nodes.push({
    dependency_id: "POLICY-COVERAGE-001",
    description: "Policy active, member eligible, procedure covered",
    status: policyFindings.policy_active && policyFindings.member_eligible && policyFindings.procedure_covered
      ? "RESOLVED" : "UNRESOLVED",
    sources: input.policy_evidence.citations || [],
    owner: "POLICY_AGENT",
    downstream_impact: "Blocks all downstream if unresolved",
    next_safe_action: "NONE",
  });

  nodes.push({
    dependency_id: "POLICY-WAITING-001",
    description: "Waiting period satisfied",
    status: policyFindings.waiting_period_satisfied ? "RESOLVED" : "UNRESOLVED",
    sources: input.policy_evidence.citations || [],
    owner: "POLICY_AGENT",
    downstream_impact: "Blocks pre-authorisation",
    next_safe_action: "NONE",
  });

  nodes.push({
    dependency_id: "POLICY-EXCLUSION-001",
    description: "No applicable exclusion found",
    status: !policyFindings.applicable_exclusion_found ? "RESOLVED" : "UNRESOLVED",
    sources: input.policy_evidence.citations || [],
    owner: "POLICY_AGENT",
    downstream_impact: "May block or reduce coverage",
    next_safe_action: "NONE",
  });

  nodes.push({
    dependency_id: "POLICY-PED-001",
    description: "No pre-existing disease restriction",
    status: !policyFindings.applicable_pre_existing_disease_restriction_found ? "RESOLVED" : "UNRESOLVED",
    sources: input.policy_evidence.citations || [],
    owner: "POLICY_AGENT",
    downstream_impact: "May block or reduce coverage",
    next_safe_action: "NONE",
  });

  nodes.push({
    dependency_id: "POLICY-ROOM-001",
    description: "Room eligibility confirmed",
    status: policyFindings.room_eligibility ? "RESOLVED" : "UNRESOLVED",
    sources: input.policy_evidence.citations || [],
    owner: "POLICY_AGENT",
    downstream_impact: "Affects cost calculation",
    next_safe_action: "NONE",
  });

  // ─── Build clinical dependency nodes ───
  nodes.push({
    dependency_id: "CLINICAL-ACCEPTANCE-001",
    description: "Doctor recommendation and diagnostic support confirmed",
    status: clinicalFindings.doctor_recommendation_confirmed && clinicalFindings.diagnostic_support_confirmed
      ? "RESOLVED" : "UNRESOLVED",
    sources: [`Clinical Record ${clinicalFindings.clinical_record_version}`],
    owner: "CLINICAL_AGENT",
    downstream_impact: "Blocks clinical pre-authorisation readiness",
    next_safe_action: "NONE",
  });

  nodes.push({
    dependency_id: "CLINICAL-NECESSITY-001",
    description: "Medical necessity supported",
    status: clinicalFindings.medical_necessity_supported ? "RESOLVED" : "UNRESOLVED",
    sources: [`Clinical Record ${clinicalFindings.clinical_record_version}`],
    owner: "CLINICAL_AGENT",
    downstream_impact: "Blocks pre-authorisation",
    next_safe_action: "NONE",
  });

  // CLINICAL-FITNESS-001 is a POST_AUTHORISATION_CONDITION
  if (clinicalFindings.post_authorisation_conditions?.includes("CLINICAL-FITNESS-001")) {
    postAuthConditions.push("CLINICAL-FITNESS-001");
    nodes.push({
      dependency_id: "CLINICAL-FITNESS-001",
      description: "Final anaesthetic fitness assessment (post-authorisation)",
      status: "POST_AUTHORISATION_CONDITION",
      sources: [`Clinical Record ${clinicalFindings.clinical_record_version}`],
      owner: "HOSPITAL",
      downstream_impact: "Required before surgery, not before pre-authorisation",
      next_safe_action: "NONE",
    });
  }

  // ─── Build cost/contract dependency nodes ───
  nodes.push({
    dependency_id: "COST-CONTRACT-001",
    description: "Hospital network confirmed, contract and estimate verified",
    status: costFindings.network_status === "CONFIRMED" ? "RESOLVED" : "UNRESOLVED",
    sources: [
      `Contract ${costFindings.contract_reference} v${costFindings.contract_version}`,
      `Estimate ${costFindings.estimate_reference} v${costFindings.estimate_version}`,
    ],
    owner: "COST_CONTRACT_AGENT",
    downstream_impact: "Affects contribution calculation",
    next_safe_action: "NONE",
  });

  nodes.push({
    dependency_id: "COST-CALCULATION-001",
    description: "Provisional contribution calculation complete",
    status: costFindings.expected_insurer_contribution !== undefined ? "RESOLVED" : "UNRESOLVED",
    sources: [`Calculation ${costFindings.calculation_version}`],
    owner: "COST_CONTRACT_AGENT",
    downstream_impact: "Required for decision packet",
    next_safe_action: "NONE",
  });

  // ─── Collect unresolved from specialist reports ───
  const allUnresolved = [
    ...input.policy_evidence.unresolved_dependencies,
    ...input.clinical_evidence.unresolved_dependencies,
    ...input.cost_contract_evidence.unresolved_dependencies,
  ];

  // ─── Check node-level unresolved ───
  for (const node of nodes) {
    if (node.status === "UNRESOLVED") {
      unresolved.push(node.dependency_id);
    }
  }

  // ─── Derive graph state with precedence ───
  let graphState: GraphState;
  let nextAction: string;

  if (unresolved.length === 0 && allUnresolved.length === 0) {
    graphState = "DECISION_READY";
    nextAction = "GENERATE_DECISION_PACKET_AND_REQUEST_HUMAN_DECISION";
    reasonCodes.push("ALL_DEPENDENCIES_RESOLVED");
  } else if (allUnresolved.some(d => typeof d === 'string' && d.includes("AMBIGUITY"))) {
    graphState = "HUMAN_AMBIGUITY";
    nextAction = "ROUTE_HUMAN_CLARIFICATION";
    reasonCodes.push("HUMAN_AMBIGUITY_DETECTED");
  } else {
    graphState = "RESOLVABLE_MISSING_EVIDENCE";
    nextAction = "REQUEST_MINIMUM_EVIDENCE";
    reasonCodes.push("RESOLVABLE_EVIDENCE_GAPS");
  }

  return {
    graph_state: graphState,
    dependency_nodes: nodes,
    unresolved_dependencies: unresolved,
    post_authorisation_conditions: postAuthConditions,
    state_reason_codes: reasonCodes,
    next_safe_action: nextAction,
    source_report_versions: buildSourceVersions(input),
  };
}

function buildSourceVersions(input: GraphBuildInput): Record<string, string> {
  const cf = input.clinical_evidence.findings as ClinicalFindings;
  const ccf = input.cost_contract_evidence.findings as CostContractFindings;

  return {
    policy: (input.policy_evidence as unknown as Record<string, unknown>).policy_version as string || "POLICY-1",
    clinical: cf.clinical_record_version || "CLIN-1",
    cost_contract: ccf.calculation_version || "CALC-1",
  };
}

"use client";

import styles from "./landing.module.css";

const MAIN_STEPS = [
  { num: "01", name: "Intake", desc: "Establish trusted case context from member, policy & hospital inputs." },
  { num: "02", name: "Pre-auth", desc: "Evaluate coverage, clinical necessity, evidence & requested amount." },
  { num: "03", name: "Discharge", desc: "Capture outcome evidence and final treatment facts." },
  { num: "04", name: "Settlement", desc: "Reconcile final bill, admissibility and payment." },
  { num: "05", name: "Closed", desc: "Durable decision packet & immutable audit history." },
];

export function LifecycleVisualization() {
  return (
    <section className={styles.lifecycleSection}>
      <div className={styles.lifecycleHeader}>
        <h2 className={styles.lifecycleTitle}>Coverage Case Lifecycle</h2>
        <p className={styles.lifecycleSub}>
          One case state moves through the primary lifecycle. Conditional workflows branch only when reality changes.
        </p>
      </div>

      <div className={styles.lifecycleMap}>
        {/* Main Architectural Lifecycle Flow */}
        <div className={styles.mainPathRow}>
          {MAIN_STEPS.map((step) => (
            <div key={step.num} className={styles.lifecycleCard}>
              <span className={styles.stepNum}>{step.num}</span>
              <h3 className={styles.stepName}>{step.name}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Conditional Branches Container */}
        <div className={styles.conditionalContainer}>
          <div className={styles.branchCard}>
            <span className={styles.branchTag}>Conditional Branch 1</span>
            <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
              Material Change Re-evaluation
            </h4>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.45 }}>
              Triggered during treatment when clinical or cost facts change. Re-evaluates delta without restarting intake.
            </p>
          </div>

          <div className={styles.branchCard}>
            <span className={styles.branchTag}>Conditional Branch 2</span>
            <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
              Appeal & Dispute Resolution
            </h4>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.45 }}>
              Triggered after settlement when member or hospital files a dispute. Resolves against original decision audit trail.
            </p>
          </div>
        </div>
      </div>

      {/* Understated System Proof Footer */}
      <div className={styles.systemProofFooter}>
        <span>6 Coordinated Yoxa Workflow Deployments</span>
        <span>1 Persistent Supabase-Backed Case Model</span>
        <span>Human-Governed Decisions</span>
      </div>
    </section>
  );
}

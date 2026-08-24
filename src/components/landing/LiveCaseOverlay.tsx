"use client";

import styles from "./landing.module.css";

export function LiveCaseOverlay() {
  return (
    <div className={styles.liveCaseOverlay}>
      <div className={styles.caseHeader}>
        <span className={styles.caseId}>CASE CT-0001</span>
        <span className={styles.caseStatusBadge}>
          <span className={styles.statusDot} />
          DECISION READY
        </span>
      </div>

      <div className={styles.caseProc}>Laparoscopic Cholecystectomy</div>
      <div className={styles.caseAmount}>₹85,000</div>

      <div className={styles.caseMetricsGrid}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Evidence Completeness</span>
          <span className={styles.metricVal}>98%</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Coverage Confidence</span>
          <span className={styles.metricVal}>96%</span>
        </div>
      </div>

      <div className={styles.caseWorkflowTrack}>
        <span className={`${styles.trackStep} ${styles.trackDone}`}>
          ✓ Intake
        </span>
        <span className={`${styles.trackStep} ${styles.trackDone}`}>
          ✓ Pre-auth
        </span>
        <span className={`${styles.trackStep} ${styles.trackActive}`}>
          ● Human Review
        </span>
      </div>

      {/* Demo visualization note clearly noted in code */}
      <div className={styles.demoNote}>* Demo Case Context Visualization</div>
    </div>
  );
}

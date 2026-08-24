"use client";

import styles from "./landing.module.css";

export function ContinuousTruthSection() {
  return (
    <section id="continuous-truth" className={styles.truthSection}>
      <div className={styles.truthGrid}>
        <h2 className={styles.truthHeadline}>
          One Case.<br />
          <strong>One Continuous Truth.</strong>
        </h2>

        <div className={styles.truthCopy}>
          <p>
            Traditional insurance workflows repeatedly reconstruct the same case across siloed systems and handoffs.
          </p>
          <p>
            Coverage Twin maintains one living state that evolves as new clinical, financial and operational evidence arrives.
          </p>
          <div className={styles.truthAccentLine}>
            <span className={styles.accentSquare} />
            THE CASE MOVES. THE CONTEXT STAYS.
          </div>
        </div>
      </div>
    </section>
  );
}

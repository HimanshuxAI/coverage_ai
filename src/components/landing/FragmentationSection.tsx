"use client";

import styles from "./landing.module.css";

const FRAGMENTS = [
  "POLICY CLAUSE 4.2",
  "USG REPORT",
  "₹85,000",
  "MEM-CT-1001",
  "DR-021",
  "NETWORK PROVIDER",
  "K80.1",
  "WAITING PERIOD",
  "DISCHARGE SUMMARY",
];

export function FragmentationSection() {
  return (
    <section className={styles.fragmentationSection}>
      <div className={styles.fragmentationGrid}>
        <div>
          <h2 className={styles.fragmentationHeadline}>
            Born<br />
            <strong>Fragmented.</strong>
          </h2>
          <span className={styles.microLabel}>Why Coverage Twin Exists</span>
        </div>

        <div className={styles.fragmentationCopy}>
          <p>
            Coverage decisions do not fail because information is absent. They fail because the information arrives fragmented across disparate systems.
          </p>
          <p>
            Policy terms live in one system. Clinical evidence in another. Financial estimates arrive separately. Documents change during treatment. Human reviewers reconstruct context repeatedly.
          </p>

          <div className={styles.problemHighlight}>
            <span className={styles.problemSquare} />
            THE PROBLEM ISN&apos;T MISSING INTELLIGENCE. IT&apos;S MISSING CONTINUITY.
          </div>
        </div>
      </div>

      {/* Detached Evidence Fragments */}
      <div className={styles.fragmentsContainer}>
        {FRAGMENTS.map((frag, idx) => (
          <div key={idx} className={styles.fragmentChip}>
            <span className={styles.fragmentDot} />
            {frag}
          </div>
        ))}
      </div>
    </section>
  );
}

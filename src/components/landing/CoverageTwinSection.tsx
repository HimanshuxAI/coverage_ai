"use client";

import styles from "./landing.module.css";
import { CoverageTwinDiagram } from "./CoverageTwinDiagram";

export function CoverageTwinSection() {
  return (
    <section id="case-structured" className={styles.structuredSection}>
      <div className={styles.structuredHeader}>
        <h2 className={styles.structuredHeadline}>
          The Case,<br />
          <strong>Structured.</strong>
        </h2>

        <p className={styles.structuredCopy}>
          Coverage Twin maintains one evolving representation of the case. Every workflow reads from it. Every validated event updates it. Every consequential decision can be traced back through it.
        </p>
      </div>

      <CoverageTwinDiagram />
    </section>
  );
}

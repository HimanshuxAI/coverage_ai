"use client";

import Link from "next/link";
import styles from "./landing.module.css";
import { HeroPixelField } from "./HeroPixelField";
import { LiveCaseOverlay } from "./LiveCaseOverlay";

export function Hero() {
  const handleScrollToSystem = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById("continuous-truth");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroGrid}>
        <div className={styles.heroLeft}>
          <h1 className={styles.heroHeadline}>
            DECISIONS,<br />
            <strong>ENGINEERED.</strong>
          </h1>

          <div className={styles.ctaGroup}>
            <Link href="/dashboard" className={styles.btnPrimary}>
              Open Live Case →
            </Link>
            <a 
              href="#continuous-truth" 
              onClick={handleScrollToSystem}
              className={styles.btnSecondary}
            >
              See The System ↓
            </a>
          </div>
        </div>

        <div className={styles.heroRight}>
          <h2 className={styles.eyebrow}>
            A Living Decision System<br />For Modern Health Insurance
          </h2>

          <p className={styles.heroDesc}>
            Coverage Twin maintains one evolving case state across pre-authorisation, treatment, discharge, settlement and appeals.
          </p>

          <div className={styles.systemProofGrid}>
            <div className={styles.proofItem}>
              <span className={styles.proofNum}>06</span>
              <span className={styles.proofLabel}>Yoxa Workflows</span>
            </div>
            <div className={styles.proofItem}>
              <span className={styles.proofNum}>TRACEABLE</span>
              <span className={styles.proofLabel}>Evidence Chain</span>
            </div>
            <div className={styles.proofItem}>
              <span className={styles.proofNum}>HITL</span>
              <span className={styles.proofLabel}>Human Governed</span>
            </div>
            <div className={styles.proofItem}>
              <span className={styles.proofNum}>PERSISTENT</span>
              <span className={styles.proofLabel}>Case State</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Pixel Transformation Canvas + Live Case Overlay */}
      <div style={{ position: "relative" }}>
        <HeroPixelField />
        <LiveCaseOverlay />
      </div>

      {/* 05 — Hero Transition Statement */}
      <div className={styles.transitionStatement}>
        <h2 className={styles.transitionText}>
          A living case model that follows every coverage decision <strong>from intake to final resolution.</strong>
        </h2>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import styles from "./landing.module.css";

export function LandingNav() {
  const handleScrollToSystem = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById("continuous-truth");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className={styles.navShell}>
      <Link href="/" className={styles.navLeft}>
        <span className={styles.navMark} aria-hidden="true" />
        <span className={styles.navTitle}>Coverage Twin</span>
      </Link>

      <nav className={styles.navRight}>
        <a 
          href="#continuous-truth" 
          onClick={handleScrollToSystem}
          className={styles.navScrollLink}
        >
          System
        </a>

        <Link href="/dashboard" className={styles.navProductBtn}>
          Live Case →
        </Link>
      </nav>
    </header>
  );
}

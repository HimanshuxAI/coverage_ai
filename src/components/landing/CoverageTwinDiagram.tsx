"use client";

import { useState } from "react";
import styles from "./landing.module.css";

interface DomainData {
  id: string;
  tag: string;
  title: string;
  mainVal: string;
  subVal: string;
  details: string[];
}

const DOMAINS: DomainData[] = [
  {
    id: "member",
    tag: "Member Domain",
    title: "MEMBER",
    mainVal: "MEM-CT-1001",
    subVal: "Active Member • Policyholder",
    details: ["Identity verified", "Age: 42 • Primary insured", "Clean claims history"],
  },
  {
    id: "policy",
    tag: "Policy Domain",
    title: "POLICY",
    mainVal: "CT-HEALTH-2026-001",
    subVal: "Comprehensive Health • Active",
    details: ["Waiting period cleared (36 mo)", "Room rent capping: No capping", "Pre-existing clause matched"],
  },
  {
    id: "clinical",
    tag: "Clinical Domain",
    title: "CLINICAL",
    mainVal: "ICD K80.1 • CPT 47562",
    subVal: "Calculus of gallbladder w/ cholecystitis",
    details: ["Laparoscopic cholecystectomy", "Clinical indication verified", "USG evidence confirmed"],
  },
  {
    id: "provider",
    tag: "Provider Domain",
    title: "PROVIDER",
    mainVal: "HSP-NIR-021",
    subVal: "Tier-1 Network Hospital",
    details: ["Pre-auth agreement active", "Cashless facility enabled", "Doctor registration valid"],
  },
  {
    id: "financial",
    tag: "Financial Domain",
    title: "FINANCIAL",
    mainVal: "₹85,000 Requested",
    subVal: "Admissible Estimate: ₹85,000",
    details: ["Tariff matched against agreement", "Deductible: ₹0", "Co-pay: 0%"],
  },
  {
    id: "evidence",
    tag: "Evidence Domain",
    title: "EVIDENCE",
    mainVal: "4 Verified Artifacts",
    subVal: "Provenance Chain Verified",
    details: ["USG scan report matched", "Doctor prescription attached", "Hospital estimate breakdown"],
  },
];

export function CoverageTwinDiagram() {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  return (
    <div className={styles.diagramWrap}>
      <div className={styles.diagramGrid}>
        {/* Top Row Domains: Member, Policy, Clinical */}
        {DOMAINS.slice(0, 3).map((d) => {
          const isActive = activeDomain === d.id;
          return (
            <div
              key={d.id}
              className={`${styles.domainNode} ${isActive ? styles.domainNodeActive : ""}`}
              onMouseEnter={() => setActiveDomain(d.id)}
              onMouseLeave={() => setActiveDomain(null)}
            >
              <div className={styles.domainTag}>
                <span className={styles.domainTagDot} />
                {d.tag}
              </div>
              <h3 className={styles.domainTitle}>{d.title}</h3>
              <p className={styles.domainDetail}>{d.mainVal}</p>

              <div className={styles.domainExpand}>
                <span>{d.subVal}</span>
                {isActive && d.details.map((item, i) => (
                  <span key={i} style={{ color: "var(--forest)", fontWeight: 600 }}>• {item}</span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Central Focal Twin Node */}
        <div className={styles.centerTwinNode}>
          <div>
            <h3 className={styles.centerTwinTitle}>
              Coverage Twin <strong>CT-0001</strong>
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--grid)" }}>
              One Canonical Evolving Case State • ₹85,000
            </p>
          </div>
          <div className={styles.centerTwinStatus}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--forest)" }} />
            DECISION READY
          </div>
        </div>

        {/* Bottom Row Domains: Provider, Financial, Evidence */}
        {DOMAINS.slice(3, 6).map((d) => {
          const isActive = activeDomain === d.id;
          return (
            <div
              key={d.id}
              className={`${styles.domainNode} ${isActive ? styles.domainNodeActive : ""}`}
              onMouseEnter={() => setActiveDomain(d.id)}
              onMouseLeave={() => setActiveDomain(null)}
            >
              <div className={styles.domainTag}>
                <span className={styles.domainTagDot} />
                {d.tag}
              </div>
              <h3 className={styles.domainTitle}>{d.title}</h3>
              <p className={styles.domainDetail}>{d.mainVal}</p>

              <div className={styles.domainExpand}>
                <span>{d.subVal}</span>
                {isActive && d.details.map((item, i) => (
                  <span key={i} style={{ color: "var(--forest)", fontWeight: 600 }}>• {item}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

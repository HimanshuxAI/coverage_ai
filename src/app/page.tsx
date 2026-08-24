"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import "./landing.css";

type MiniBarStyle = CSSProperties & {
  "--w": string;
};

function createMiniBarStyle(width: string, background?: string): MiniBarStyle {
  return background ? { "--w": width, background } : { "--w": width };
}

export default function LandingPage() {
  const [, setActiveShowcaseStage] = useState(0);
  const [originProgress, setOriginProgress] = useState(0);
  const [judgementProgress, setJudgementProgress] = useState(0);
  const [activeLifecycleStep, setActiveLifecycleStep] = useState(0);

  useEffect(() => {
    const onScrollAll = () => {
      // 1. Showcase Section
      const scSec = document.getElementById("showcaseSection");
      if (scSec) {
        const rect = scSec.getBoundingClientRect();
        const dist = scSec.offsetHeight - window.innerHeight;
        if (dist > 0) {
          const prog = Math.max(0, Math.min(1, -rect.top / dist));
          setActiveShowcaseStage(Math.min(4, Math.floor(prog * 5.0)));
        }
      }

      // 2. Origin Section (Born Fragmented)
      const origSec = document.getElementById("originSection");
      if (origSec) {
        const rect = origSec.getBoundingClientRect();
        const dist = origSec.offsetHeight - window.innerHeight;
        if (dist > 0) {
          const prog = Math.max(0, Math.min(1, -rect.top / dist));
          setOriginProgress(prog);
        }
      }

      // 3. Judgement Section (AI vs Human)
      const judgeSec = document.getElementById("judgementSection");
      if (judgeSec) {
        const rect = judgeSec.getBoundingClientRect();
        const dist = judgeSec.offsetHeight - window.innerHeight;
        if (dist > 0) {
          const prog = Math.max(0, Math.min(1, -rect.top / dist));
          setJudgementProgress(prog);
        }
      }

      // 4. Lifecycle Section (Intake. Decide.)
      const lifeSec = document.getElementById("lifecycleSection");
      if (lifeSec) {
        const rect = lifeSec.getBoundingClientRect();
        const dist = lifeSec.offsetHeight - window.innerHeight;
        if (dist > 0) {
          const prog = Math.max(0, Math.min(1, -rect.top / dist));
          setActiveLifecycleStep(Math.min(5, Math.floor(prog * 6.0)));
        }
      }
    };

    window.addEventListener("scroll", onScrollAll, { passive: true });
    onScrollAll();
    return () => window.removeEventListener("scroll", onScrollAll);
  }, []);

  useEffect(() => {
    const COLORS = {
      bg: "#F4F6F3",
      ink: "#07130C",
      forest: "#063B22",
      lime: "#C7F36B",
      green: "#20C878",
      grid: "#DCE2DD",
      muted: "#68716B"
    };

    function fitCanvas(canvas: HTMLCanvasElement) {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w: rect.width, h: rect.height, dpr };
    }

    function seedRand(seed: number) {
      let x = seed >>> 0;
      return () => {
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        return ((x >>> 0) % 10000) / 10000;
      };
    }

    function drawHero() {
      const canvas = document.getElementById("heroPixels") as HTMLCanvasElement | null;
      if (!canvas) return;
      const { ctx, w, h } = fitCanvas(canvas);
      if (!ctx) return;
      const rand = seedRand(1407);
      const cell = Math.max(7, Math.min(13, w / 150));
      const cols = Math.ceil(w / cell) + 4;
      const rows = Math.ceil(h / cell) + 4;
      const t = performance.now() * 0.00018;
      const scrollShift = Math.min(1, window.scrollY / Math.max(1, h * 1.15));

      ctx.clearRect(0, 0, w, h);

      for (let x = 0; x < cols; x++) {
        const px = x * cell;
        const nx = px / w;
        const band1 = 0.24 + 0.12 * Math.sin(nx * 4.0 + t * 0.9) + 0.05 * Math.cos(nx * 8.0 - t * 0.5);
        const band2 = 0.46 + 0.12 * Math.sin(nx * 3.5 - 0.6 + t * 0.8);
        const band3 = 0.68 + 0.10 * Math.sin(nx * 4.2 + 1.2 - t * 1.0);
        for (let y = 0; y < rows; y++) {
          const py = y * cell;
          const ny = py / h;
          const r = rand();
          let color = null;
          const d1 = Math.abs(ny - band1);
          const d2 = Math.abs(ny - band2);
          const d3 = Math.abs(ny - band3);
          const falloff = scrollShift * .24;

          // Boost right-edge density to guarantee 100% full edge coverage
          const isRightEdge = nx > 0.82;
          const rThresh = isRightEdge ? 0.05 : 0;

          if (d1 < (isRightEdge ? .21 : .19) - falloff && r > (.14 - rThresh) + scrollShift * .28) color = COLORS.forest;
          if (d2 < (isRightEdge ? .18 : .16) - falloff && r > (.22 - rThresh) + scrollShift * .22) color = COLORS.green;
          if (d3 < (isRightEdge ? .18 : .15) - falloff && r > (.19 - rThresh) + scrollShift * .25) color = COLORS.lime;

          if (color) {
            const alpha = .76 + rand() * .24;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    let heroRAF = 0;
    function heroLoop() {
      drawHero();
      heroRAF = requestAnimationFrame(heroLoop);
    }

    function drawScatter() {
      const canvas = document.getElementById("scatterPixels") as HTMLCanvasElement | null;
      if (!canvas) return;
      const { ctx, w, h } = fitCanvas(canvas);
      if (!ctx) return;

      const originSec = document.getElementById("originSection");
      let progress = 0.5;
      if (originSec) {
        const rect = originSec.getBoundingClientRect();
        const dist = originSec.offsetHeight - window.innerHeight;
        if (dist > 0) progress = Math.max(0, Math.min(1, -rect.top / dist));
      }

      const rand = seedRand(9042);
      const count = Math.floor(Math.min(360, w / 3.5));
      ctx.clearRect(0, 0, w, h);

      // 6 Domain Node Centers (MEMBER, POLICY, CLINICAL, PROVIDER, FINANCIAL, EVIDENCE)
      const domainNodes = [
        { x: w * 0.20, y: h * 0.30 }, // MEMBER
        { x: w * 0.50, y: h * 0.22 }, // POLICY
        { x: w * 0.80, y: h * 0.30 }, // CLINICAL
        { x: w * 0.20, y: h * 0.70 }, // PROVIDER
        { x: w * 0.50, y: h * 0.78 }, // FINANCIAL
        { x: w * 0.80, y: h * 0.70 }, // EVIDENCE
      ];
      const centerCore = { x: w * 0.50, y: h * 0.50 };

      const colors = [COLORS.forest, COLORS.green, COLORS.lime];

      for (let i = 0; i < count; i++) {
        const baseX = rand() * w;
        const baseY = rand() * h;
        const targetNode = domainNodes[i % domainNodes.length];

        let curX = baseX;
        let curY = baseY;

        if (progress < 0.30) {
          // 0-30%: Fragmented random positions
          curX = baseX;
          curY = baseY;
        } else if (progress < 0.70) {
          // 30-70%: Gather into 6 domain nodes
          const p = (progress - 0.30) / 0.40;
          curX = baseX * (1 - p) + targetNode.x * p + (rand() - 0.5) * 40;
          curY = baseY * (1 - p) + targetNode.y * p + (rand() - 0.5) * 40;
        } else {
          // 70-100%: Connect domain nodes to central COVERAGE TWIN core
          const p = (progress - 0.70) / 0.30;
          const nodeX = targetNode.x + (rand() - 0.5) * 30;
          const nodeY = targetNode.y + (rand() - 0.5) * 30;
          curX = nodeX * (1 - p * 0.55) + centerCore.x * (p * 0.55);
          curY = nodeY * (1 - p * 0.55) + centerCore.y * (p * 0.55);
        }

        const s = 6;
        const color = progress > 0.65 ? (i % 2 === 0 ? COLORS.lime : COLORS.green) : colors[i % colors.length];
        ctx.globalAlpha = 0.60 + rand() * 0.40;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(curX / s) * s, Math.round(curY / s) * s, s - 1, s - 1);
      }

      // Draw connecting grid lines when structured
      if (progress > 0.55) {
        ctx.globalAlpha = (progress - 0.55) * 1.8;
        ctx.strokeStyle = COLORS.lime;
        ctx.lineWidth = 1;
        for (const node of domainNodes) {
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(centerCore.x, centerCore.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawFlow(canvas: HTMLCanvasElement, mode: "lifecycle" | "protocol") {
      const { ctx, w, h } = fitCanvas(canvas);
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
      ctx.clearRect(0, 0, w, h);
      const rand = seedRand(mode === "lifecycle" ? 1743 : 6112);
      const count = Math.min(760, Math.floor(w * .55));
      for (let i = 0; i < count; i++) {
        const u = i / count;
        const yNoise = (rand() - .5) * h * .45;
        let x, y, color;
        if (mode === "lifecycle") {
          x = w * (.06 + .88 * u);
          const amp = 90 * (1 - Math.abs(u - .5) * 1.55);
          y = h * .50 + Math.sin(u * 10.5) * amp + yNoise * .26;
          if (u < .35) color = COLORS.green;
          else if (u < .7) color = COLORS.lime;
          else color = COLORS.forest;
        } else {
          x = w * (.03 + .94 * u);
          const spread = 150 * (Math.abs(u - .5) * 1.6 + .1);
          y = h * .5 + (rand() - .5) * spread + Math.sin(u * 8) * 40;
          color = u < .38 ? COLORS.forest : (u < .72 ? COLORS.green : COLORS.lime);
        }
        const reveal = Math.min(1, Math.max(0, (p * 1.35) - u * .3));
        if (rand() < reveal) {
          const s = 6;
          ctx.globalAlpha = .55 + rand() * .45;
          ctx.fillStyle = color;
          ctx.fillRect(Math.round(x / s) * s, Math.round(y / s) * s, s - 1, s - 1);
        }
      }
      ctx.globalAlpha = 1;
    }

    const lifecycle = document.getElementById("lifecyclePixels") as HTMLCanvasElement | null;
    const protocol = document.getElementById("protocolPixels") as HTMLCanvasElement | null;

    function renderScrollCanvases() {
      drawScatter();
      if (lifecycle) drawFlow(lifecycle, "lifecycle");
      if (protocol) drawFlow(protocol, "protocol");
    }

    // Pixel cursor
    const cursor = document.getElementById("pixelCursor");
    let mx = -100, my = -100, cx = -100, cy = -100;
    const onMouseMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      if (cursor) cursor.style.opacity = "1";
    };
    const onMouseLeave = () => {
      if (cursor) cursor.style.opacity = "0";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    let cursorRAF = 0;
    function cursorLoop() {
      cx += (mx - cx) * .18; cy += (my - cy) * .18;
      if (cursor) {
        cursor.style.transform = `translate(${cx - 24}px,${cy - 24}px) rotate(${Math.sin(performance.now() / 500) * 3}deg)`;
      }
      cursorRAF = requestAnimationFrame(cursorLoop);
    }

    // Horizontal work rail
    const rail = document.getElementById("caseRail");
    const onWheel = (e: WheelEvent) => {
      if (rail && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        rail.scrollLeft += e.deltaY * .85;
      }
    };
    if (rail) {
      rail.addEventListener("wheel", onWheel, { passive: true });
    }

    let scrollTick = false;
    const onScroll = () => {
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => {
        renderScrollCanvases();
        scrollTick = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => {
      drawHero();
      renderScrollCanvases();
    };

    window.addEventListener("resize", onResize);

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      heroLoop();
      cursorLoop();
    } else {
      drawHero();
    }
    renderScrollCanvases();

    return () => {
      cancelAnimationFrame(heroRAF);
      cancelAnimationFrame(cursorRAF);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rail) rail.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div className="site-shell">
      <Link className="site-link" href="/dashboard">
        OPEN COVERAGE TWIN ↗
      </Link>

      <header className="hero" id="top">
        <div className="hero-copy hero-left">
          <h1>DECISIONS,<br />ENGINEERED.</h1>
        </div>
        <div className="hero-copy hero-right">
          <p className="eyebrow-large">A LIVING COVERAGE TWIN<br />FOR MODERN HEALTH INSURANCE</p>
          <div className="hero-meta">
            <span className="pixel-mark" aria-hidden="true"></span>
            <p>Six coordinated Yoxa workflows. Evidence-traceable reasoning. Human-governed decisions.</p>
          </div>
        </div>
        <div className="hero-canvas-wrap">
          <canvas id="heroPixels" aria-hidden="true"></canvas>
        </div>
        <div className="hero-intro">
          <p>A living case model that follows every coverage decision from intake to pre-authorisation, treatment, discharge, settlement and appeal.</p>
        </div>
      </header>

      <main>
        <section className="showcase section-pad">
          <div className="section-heading split-heading">
            <h2>One case.<br />One continuous truth.</h2>
            <p>Coverage Twin turns fragmented policy, clinical, financial and operational evidence into a decision-ready case that evolves instead of restarting at every stage.</p>
          </div>

          <div className="case-rail" id="caseRail">
            <article className="case-card">
              <div className="case-visual visual-preauth">
                <div className="mini-ui">
                  <span className="mini-kicker">STAGE 01 • PRE-AUTH</span>
                  <strong>₹85,000</strong>
                  <small>Laparoscopic cholecystectomy</small>
                  <div className="mini-bars">
                    <span style={createMiniBarStyle("92%")}></span>
                    <span style={createMiniBarStyle("78%")}></span>
                    <span style={createMiniBarStyle("86%")}></span>
                  </div>
                  <span className="mini-status">● DECISION READY</span>
                </div>
              </div>
              <h3>Pre-authorisation</h3>
              <p>Evidence, coverage and clinical necessity synthesized into a reviewable recommendation.</p>
            </article>

            <article className="case-card">
              <div className="case-visual visual-re-eval">
                <div className="mini-ui">
                  <span className="mini-kicker">STAGE 02 • RE-EVALUATION</span>
                  <strong style={{ fontSize: "24px" }}>Δ FACT CHANGE</strong>
                  <small>Material fact change detected in treatment plan.</small>
                  <div className="mini-bars">
                    <span style={createMiniBarStyle("100%", "var(--warning)")}></span>
                    <span style={createMiniBarStyle("65%", "var(--warning)")}></span>
                  </div>
                  <span className="mini-status warning">● RE-CALIBRATED</span>
                </div>
              </div>
              <h3>Material change</h3>
              <p>Re-evaluates downstream implications without invalidating baseline context.</p>
            </article>

            <article className="case-card">
              <div className="case-visual visual-discharge">
                <div className="mini-ui">
                  <span className="mini-kicker">STAGE 03 • RECONCILIATION</span>
                  <div className="mini-grid-lines">
                    <div><span>Clinical Summary</span><b>MATCHED ✓</b></div>
                    <div><span>Discharge Facts</span><b>VERIFIED ✓</b></div>
                    <div><span>Admissibility</span><b>CLEAN (0% Co-pay)</b></div>
                  </div>
                  <span className="mini-status">● DISCHARGE READY</span>
                </div>
              </div>
              <h3>Discharge & settlement</h3>
              <p>Reconciles outcome facts and actual costs against authorized limits.</p>
            </article>

            <article className="case-card">
              <div className="case-visual visual-audit">
                <div className="mini-ui">
                  <span className="mini-kicker">DURABLE AUDIT TRAIL</span>
                  <div className="mini-log">
                    <div><span>01</span><b>INTAKE</b><i>ACCEPTED</i></div>
                    <div><span>02</span><b>PREAUTH</b><i>AUTHORISED</i></div>
                    <div><span>03</span><b>REEVAL</b><i>UNCHANGED</i></div>
                    <div><span>04</span><b>SETTLE</b><i>EXECUTED</i></div>
                  </div>
                  <span className="mini-status" style={{ background: "var(--lime)", color: "var(--forest)" }}>● AUDIT VERIFIED</span>
                </div>
              </div>
              <h3>Audit by construction</h3>
              <p>Every important transition leaves a durable who / what / when / why / source trail.</p>
            </article>

            <article className="case-card">
              <div className="case-visual visual-settle">
                <div className="mini-ui">
                  <span className="mini-kicker">DECISION RECORD</span>
                  <div className="settle-total">₹85,000</div>
                  <div className="settle-line"><span>Requested</span><b>₹85,000</b></div>
                  <div className="settle-line"><span>Eligible</span><b>₹85,000</b></div>
                  <div className="settle-line"><span>Outcome</span><b>AUTHORISE</b></div>
                  <div style={{ marginTop: 12 }}>
                    <span className="mini-status">● PACKET RECORDED</span>
                  </div>
                </div>
              </div>
              <h3>Decision packet</h3>
              <p>The recommendation, evidence, reviewer action and timestamps collapse into one defensible record.</p>
            </article>
          </div>
        </section>

        <section className="origin section-pad" id="originSection">
          <div className="origin-sticky-container">
            <div className="origin-left">
              <div className="section-heading">
                <h2>Born fragmented.<br />Made coherent.</h2>
                <p className="micro-label">WHY COVERAGE TWIN EXISTS</p>
              </div>
              <div className="long-copy" style={{ marginTop: 20 }}>
                <p>Coverage decisions are rarely blocked by a lack of data. They are blocked because the data arrives in different formats, at different times, across different systems.</p>
                <p><span className="bullet-square"></span> Policy clauses, hospital evidence, clinical facts, cost estimates and human judgement all need to agree before a consequential decision can be trusted.</p>
                <p className="muted">Coverage Twin keeps those pieces close, structured and traceable from first intake to final resolution.</p>
              </div>
              <div className="origin-stage-badge">
                <span className="stage-indicator">
                  ● {originProgress < 0.3 ? "01 FRAGMENTED EVIDENCE" : originProgress < 0.7 ? "02 CLUSTERING EVIDENCE" : "03 CANONICAL CASE STATE"}
                </span>
              </div>
            </div>

            <div className="origin-right">
              <div className="origin-canvas-wrap">
                <canvas id="scatterPixels" className="section-canvas" aria-hidden="true"></canvas>
                <div className="origin-network-overlay">
                  <div className={`network-node node-member ${originProgress > 0.35 ? "visible" : ""}`}>
                    <span>MEMBER</span><b>MEM-CT-1001</b>
                  </div>
                  <div className={`network-node node-policy ${originProgress > 0.35 ? "visible" : ""}`}>
                    <span>POLICY</span><b>CT-HEALTH-2026</b>
                  </div>
                  <div className={`network-node node-clinical ${originProgress > 0.35 ? "visible" : ""}`}>
                    <span>CLINICAL</span><b>ICD-10 K80.1</b>
                  </div>
                  <div className={`network-node node-provider ${originProgress > 0.35 ? "visible" : ""}`}>
                    <span>PROVIDER</span><b>HSP-NIR-021</b>
                  </div>
                  <div className={`network-node node-financial ${originProgress > 0.35 ? "visible" : ""}`}>
                    <span>FINANCIAL</span><b>₹85,000</b>
                  </div>
                  <div className={`network-node node-evidence ${originProgress > 0.35 ? "visible" : ""}`}>
                    <span>EVIDENCE</span><b>4 ARTIFACTS</b>
                  </div>
                  <div className={`network-core-node ${originProgress > 0.65 ? "visible" : ""}`}>
                    <strong>COVERAGE TWIN</strong>
                    <small>CANONICAL STATE</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="judgement section-pad" id="judgementSection">
          <div className="two-col-title">
            <div>
              <h2>AI is good at analysis.<br />Humans own the consequential call.</h2>
              <p className="micro-label">HUMAN GOVERNANCE</p>
            </div>
            <div className="long-copy">
              <p>The system can classify, cross-check, retrieve evidence and produce a recommendation at machine speed.</p>
              <p>The final call still needs an accountable reviewer whenever the case is consequential, ambiguous or exceptional.</p>
            </div>
          </div>

          <div className="governance-split-container">
            {/* Left Side: AI */}
            <div className="governance-side side-ai">
              <div className="pixel-face face-ai" aria-hidden="true">
                <span className="eye left-eye"></span>
                <span className="eye right-eye"></span>
                <span className="visor-line"></span>
              </div>
              <span className="micro-label side-tag">BRILLIANT AT</span>
              <div className="capability-list">
                <div className={`cap-item ${judgementProgress > 0.15 ? "active" : ""}`}>
                  <span className="cap-check">✓</span> RETRIEVE EVIDENCE
                </div>
                <div className={`cap-item ${judgementProgress > 0.30 ? "active" : ""}`}>
                  <span className="cap-check">✓</span> COMPARE FACTS
                </div>
                <div className={`cap-item ${judgementProgress > 0.45 ? "active" : ""}`}>
                  <span className="cap-check">✓</span> SURFACE CONTRADICTIONS
                </div>
              </div>
            </div>

            {/* Center: Handoff Flow */}
            <div className="handoff-connector">
              <div className="handoff-line">
                <span className="handoff-pulse-pixel" style={{ left: `${Math.min(100, Math.max(0, (judgementProgress - 0.2) * 200))}%` }}></span>
              </div>
              <div className={`handoff-badge ${judgementProgress > 0.45 ? "resolved" : ""}`}>
                <span className="kicker">AI RECOMMENDATION</span>
                <strong>AUTHORISE ₹85,000</strong>
              </div>
            </div>

            {/* Right Side: Human */}
            <div className="governance-side side-human">
              <div className="pixel-face face-human" aria-hidden="true">
                <span className="eye left-eye"></span>
                <span className="eye right-eye"></span>
                <span className="brow-line"></span>
              </div>
              <span className="micro-label side-tag">ACCOUNTABLE OWNER</span>
              <div className="capability-list">
                <div className={`cap-item ${judgementProgress > 0.35 ? "active" : ""}`}>
                  <span className="cap-num">01</span> RESOLVE AMBIGUITY
                </div>
                <div className={`cap-item ${judgementProgress > 0.50 ? "active" : ""}`}>
                  <span className="cap-num">02</span> OWNS EXCEPTIONS
                </div>
                <div className={`cap-item ${judgementProgress > 0.65 ? "active lime-highlight" : ""}`}>
                  <span className="cap-num">03</span> FINAL ACCOUNTABILITY
                </div>
              </div>
            </div>
          </div>

          <div className={`judgement-payoff ${judgementProgress > 0.5 ? "visible" : ""}`}>
            <p className="payoff-text">The machine narrows the problem. The reviewer owns the decision.</p>
          </div>
        </section>

        <section className="lifecycle section-pad" id="lifecycleSection">
          <div className="lifecycle-sticky-container">
            <div className="lifecycle-header-block">
              <div>
                <h2>Intake. Decide.<br />Re-evaluate. Settle.</h2>
                <p className="micro-label">THE LIVING CASE STATE</p>
              </div>
              <div className="lifecycle-lead">
                <p>One case state moves through the lifecycle. Conditional workflows branch only when reality changes.</p>
              </div>
            </div>

            <div className="lifecycle-canvas-wrapper">
              <canvas id="lifecyclePixels" className="lifecycle-canvas" aria-hidden="true"></canvas>
            </div>

            <div className="lifecycle-steps">
              <div className={`step-item ${activeLifecycleStep >= 0 ? "active" : ""}`}>
                <b>01</b><strong>Intake</strong>
                <p>Normalise the case and establish a trusted starting state.</p>
              </div>
              <div className={`step-item ${activeLifecycleStep >= 1 ? "active" : ""}`}>
                <b>02</b><strong>Pre-auth</strong>
                <p>Evaluate coverage, necessity, evidence and requested amount.</p>
              </div>
              <div className={`step-item ${activeLifecycleStep === 2 ? "active amber-branch" : ""}`}>
                <b>03</b><strong>Re-evaluate</strong>
                <p>Only when a material fact changes (conditional branch).</p>
              </div>
              <div className={`step-item ${activeLifecycleStep >= 3 ? "active" : ""}`}>
                <b>04</b><strong>Discharge</strong>
                <p>Collect outcome evidence and final treatment facts.</p>
              </div>
              <div className={`step-item ${activeLifecycleStep >= 4 ? "active" : ""}`}>
                <b>05</b><strong>Settlement</strong>
                <p>Reconcile final bill, admissibility and payment.</p>
              </div>
              <div className={`step-item ${activeLifecycleStep === 5 ? "active" : ""}`}>
                <b>06</b><strong>Appeal</strong>
                <p>Resolve disputes without losing original decision trail.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="protocol section-pad">
          <div className="protocol-grid">
            <div>
              <p className="micro-label">THE COVERAGE CONTEXT PROTOCOL</p>
              <h2>The twin is not a summary.<br />It is the operating state.</h2>
            </div>
            <div className="long-copy">
              <p>Every workflow reads from and contributes to one canonical case model. That keeps downstream decisions grounded in the same evidence instead of rebuilding context from scratch.</p>
              <Link className="black-pill" href="/dashboard">OPEN THE PRODUCT</Link>
            </div>
          </div>
          <div className="protocol-wave">
            <canvas id="protocolPixels" aria-hidden="true"></canvas>
          </div>
        </section>

        <section className="levels section-pad">
          <div className="levels-grid">
            <div>
              <h2>Move the case through levels of certainty.</h2>
              <p className="micro-label">DECISION STATE, NOT CHAT HISTORY</p>
            </div>
            <div className="long-copy">
              <p>Coverage Twin advances only when the evidence supports the next state. Ambiguity pauses the system; it does not get papered over.</p>
              <div className="level-row"><span>L1</span><b>Observed.</b><p>Evidence received, not yet validated.</p></div>
              <div className="level-row"><span>L2</span><b>Validated.</b><p>Source and case facts agree.</p></div>
              <div className="level-row"><span>L3</span><b>Decision-ready.</b><p>Policy, clinical and financial evidence align.</p></div>
              <div className="level-row"><span>L4</span><b>Human-governed.</b><p>Reviewer action completes the consequential step.</p></div>
            </div>
          </div>
        </section>

        <section className="evidence section-pad">
          <h2>Evidence is everywhere.<br />Judgement needs a system.</h2>
          <p className="evidence-lead">A real coverage decision is not one model output. It is a chain of evidence, rules, exceptions and accountable actions.</p>
          <div className="proof-rail">
            <article><span className="proof-icon">P</span><h3>Policy</h3><p>Matched clauses, limits, waiting periods and exclusions.</p></article>
            <article><span className="proof-icon">C</span><h3>Clinical</h3><p>Diagnosis, procedure, necessity and supporting documents.</p></article>
            <article><span className="proof-icon">₹</span><h3>Financial</h3><p>Requested amount, admissible amount and final reconciliation.</p></article>
            <article><span className="proof-icon">H</span><h3>Human</h3><p>Reviewer decision, reason, timestamp and override trail.</p></article>
          </div>
        </section>

        <section className="closing section-pad" id="launch">
          <div className="pixel-headline" aria-label="The answer is evidence, not vibes.">
            <span>THE ANSWER IS EVIDENCE.</span>
          </div>
          <div className="closing-grid">
            <div>
              <Link className="black-pill big" href="/dashboard">Launch Coverage Twin</Link>
            </div>
            <div>
              <p>See a case move from fragmented inputs to an evidence-grounded recommendation, a human decision and a complete audit record.</p>
              <p className="muted">Built on six coordinated Yoxa workflows with Supabase-backed state and idempotent orchestration.</p>
            </div>
          </div>
          <div className="footer-pixels" aria-hidden="true"></div>
        </section>
      </main>

      <div id="pixelCursor" aria-hidden="true">
        <span></span>
      </div>
    </div>
  );
}

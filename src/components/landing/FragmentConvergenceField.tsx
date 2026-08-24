"use client";

import { useEffect, useRef } from "react";
import styles from "./landing.module.css";

const COLORS = {
  bg: "#F4F6F3",
  forest: "#063B22",
  green: "#20C878",
  lime: "#C7F36B",
  brightLime: "#D8FF78",
  muted: "#68716B"
};

export function FragmentConvergenceField() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let isReducedMotion = false;

    if (typeof window !== "undefined") {
      isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    const fitCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: rect.width, h: rect.height };
    };

    let { w, h } = fitCanvas();

    const handleResize = () => {
      const size = fitCanvas();
      w = size.w;
      h = size.h;
    };

    window.addEventListener("resize", handleResize);

    // Initial scatter particles
    const particleCount = 280;
    const particles = Array.from({ length: particleCount }, (_, i) => {
      const seed = (i * 9301 + 49297) % 233280 / 233280;
      return {
        initialX: (seed * 0.9 + 0.05) * w,
        initialY: ((seed * 3.7) % 1) * h,
        size: 5 + (seed < 0.3 ? 2 : 0),
        seed,
      };
    });

    const render = () => {
      ctx.clearRect(0, 0, w, h);

      // Calculate scroll progress relative to container
      const rect = container.getBoundingClientRect();
      const windowH = window.innerHeight || 800;
      const rawProgress = Math.max(0, Math.min(1, (windowH - rect.top) / (windowH + rect.height)));
      const progress = isReducedMotion ? 1 : rawProgress;

      const centerX = w * 0.5;
      const centerY = h * 0.5;

      // 1. Draw Orthogonal Connection Lines when progress > 0.45
      if (progress > 0.45) {
        const lineAlpha = Math.min(1, (progress - 0.45) * 3);
        ctx.globalAlpha = lineAlpha * 0.35;
        ctx.strokeStyle = COLORS.forest;
        ctx.lineWidth = 1;

        // Orthogonal Grid Lines to Center Twin
        ctx.beginPath();
        // Top to Center
        ctx.moveTo(centerX, centerY - 140);
        ctx.lineTo(centerX, centerY);
        // Left to Center
        ctx.moveTo(centerX - 180, centerY);
        ctx.lineTo(centerX, centerY);
        // Right to Center
        ctx.moveTo(centerX + 180, centerY);
        ctx.lineTo(centerX, centerY);
        // Bottom to Center
        ctx.moveTo(centerX, centerY + 140);
        ctx.lineTo(centerX, centerY);
        ctx.stroke();

        ctx.globalAlpha = 1;
      }

      // 2. Draw Pixel Particles moving inward as progress increases
      for (const p of particles) {
        // Target cluster positions around center Twin
        const clusterOffset = (p.seed - 0.5) * 120;
        const targetX = centerX + Math.sin(p.seed * 12) * (140 + clusterOffset * 0.2);
        const targetY = centerY + Math.cos(p.seed * 8) * (80 + clusterOffset * 0.2);

        // Interpolate position based on scroll progress
        const gatherEase = Math.min(1, Math.max(0, (progress - 0.15) * 1.4));
        const currentX = p.initialX * (1 - gatherEase) + targetX * gatherEase;
        const currentY = p.initialY * (1 - gatherEase) + targetY * gatherEase;

        const s = p.size;
        const gx = Math.round(currentX / s) * s;
        const gy = Math.round(currentY / s) * s;

        // Signal Lime activates as inputs join the central structure
        let color = COLORS.forest;
        if (gatherEase > 0.65) {
          color = p.seed < 0.4 ? COLORS.lime : (p.seed < 0.7 ? COLORS.green : COLORS.forest);
        } else if (gatherEase > 0.3) {
          color = p.seed < 0.5 ? COLORS.green : COLORS.forest;
        }

        ctx.globalAlpha = 0.55 + p.seed * 0.45;
        ctx.fillStyle = color;
        ctx.fillRect(gx, gy, s - 1, s - 1);
      }

      // 3. Draw Central Converged Coverage Twin Node when progress > 0.7
      if (progress > 0.7 || isReducedMotion) {
        const twinAlpha = Math.min(1, (progress - 0.7) * 3.3);
        ctx.globalAlpha = twinAlpha;

        const boxW = 200;
        const boxH = 64;
        const bx = centerX - boxW / 2;
        const by = centerY - boxH / 2;

        // Deep Forest Base Card with Lime Border
        ctx.fillStyle = COLORS.forest;
        ctx.fillRect(bx, by, boxW, boxH);

        ctx.strokeStyle = COLORS.lime;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, boxW, boxH);

        // Text Labels
        ctx.fillStyle = COLORS.lime;
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("COVERAGE TWIN", bx + 16, by + 26);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "600 13px sans-serif";
        ctx.fillText("CT-0001 • STATEFUL", bx + 16, by + 46);

        ctx.globalAlpha = 1;
      }

      if (!isReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <section id="convergence" className={styles.convergenceSection}>
      <div className={styles.convergenceHeader}>
        <h2 className={styles.convergenceTitle}>Evidence Convergence</h2>
        <p className={styles.convergenceSub}>
          Watch fragmented inputs align into one structured Coverage Twin state as you scroll.
        </p>
      </div>

      <div ref={containerRef} className={styles.convergenceCanvasWrap}>
        <canvas ref={canvasRef} className={styles.convergenceCanvas} aria-hidden="true" />
      </div>

      {/* Transition Statement */}
      <div className={styles.convergenceTransitionStatement}>
        <h3 className={styles.convergenceTransitionText}>
          The case stops being a collection of documents. <strong>It becomes a stateful system.</strong>
        </h3>
      </div>
    </section>
  );
}

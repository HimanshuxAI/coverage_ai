"use client";

import { useEffect, useRef } from "react";
import styles from "./landing.module.css";

const COLORS = {
  bg: "#F4F6F3",
  forest: "#063B22",
  green: "#20C878",
  lime: "#C7F36B",
  brightLime: "#D8FF78",
};

export function HeroPixelField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    // Simple deterministic pseudo-random generator
    function seedRand(seed: number) {
      let x = seed >>> 0;
      return () => {
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        return ((x >>> 0) % 10000) / 10000;
      };
    }

    const renderFrame = () => {
      ctx.clearRect(0, 0, w, h);

      const cell = Math.max(8, Math.min(14, w / 140));
      const cols = Math.ceil(w / cell) + 4;
      const rows = Math.ceil(h / cell) + 4;
      const t = isReducedMotion ? 0.5 : performance.now() * 0.00018;

      const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
      const scrollShift = Math.min(1, scrollY / Math.max(1, h * 0.8));

      const rand = seedRand(1407);

      // Smooth mathematical ribbon centers for structured pathways
      for (let x = 0; x < cols; x++) {
        const px = x * cell;
        const nx = px / w;

        const y1 = h * 0.22 + Math.sin(nx * 3.8 + t * 0.8) * h * 0.12 + Math.cos(nx * 7.5 - t * 0.6) * h * 0.04;
        const y2 = y1 + h * 0.20 + Math.sin(nx * 3.2 - 0.6 + t * 0.7) * h * 0.05;
        const y3 = y2 + h * 0.22 + Math.sin(nx * 4.5 + 1.0 - t * 0.9) * h * 0.04;

        const thick1 = h * 0.15 * (1 - scrollShift * 0.2);
        const thick2 = h * 0.14 * (1 - scrollShift * 0.2);
        const thick3 = h * 0.18 * (1 - scrollShift * 0.2);

        for (let y = 0; y < rows; y++) {
          const py = y * cell;
          const r = rand();

          const d1 = Math.abs(py - y1);
          const d2 = Math.abs(py - y2);
          const d3 = Math.abs(py - y3);

          let color = null;

          // Color layer evaluation: Lime -> Green -> Forest
          if (d3 < thick3 && r > 0.12 + scrollShift * 0.18) {
            color = COLORS.lime;
          } else if (d2 < thick2 && r > 0.14 + scrollShift * 0.18) {
            color = COLORS.green;
          } else if (d1 < thick1 && r > 0.10 + scrollShift * 0.20) {
            color = COLORS.forest;
          }

          if (color) {
            ctx.globalAlpha = 0.76 + rand() * 0.24;
            ctx.fillStyle = color;
            ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
          }
        }
      }

      ctx.globalAlpha = 1;

      // Focal Decision Signal Box (Lime convergence focal point)
      if (scrollShift > 0.15 || isReducedMotion) {
        const signalX = w * 0.42;
        const signalY = h * 0.68;
        const alphaSignal = Math.min(1, (scrollShift - 0.15) * 3);

        ctx.globalAlpha = alphaSignal;
        ctx.fillStyle = COLORS.forest;
        ctx.fillRect(signalX - 2, signalY - 2, 180, 42);

        ctx.fillStyle = COLORS.lime;
        ctx.fillRect(signalX, signalY, 176, 38);

        ctx.fillStyle = COLORS.forest;
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("AUTHORISE ₹85,000", signalX + 14, signalY + 23);
        ctx.globalAlpha = 1;
      }

      if (!isReducedMotion) {
        animationFrameId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <div className={styles.pixelCanvasWrap}>
      <canvas ref={canvasRef} className={styles.heroCanvas} aria-hidden="true" />
    </div>
  );
}

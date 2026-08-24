(() => {
  const COLORS = {
    bg: "#F4F6F3",
    ink: "#07130C",
    forest: "#063B22",
    lime: "#C7F36B",
    green: "#20C878",
    brightLime: "#D8FF78",
    grid: "#DCE2DD",
    muted: "#68716B"
  };

  const canvasSizes = new WeakMap();

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.floor(rect.width * dpr));
    const targetH = Math.max(1, Math.floor(rect.height * dpr));

    const prev = canvasSizes.get(canvas);
    if (!prev || prev.w !== targetW || prev.h !== targetH || prev.dpr !== dpr) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvasSizes.set(canvas, { w: targetW, h: targetH, dpr });
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height, dpr };
  }

  // Position-independent pseudo-random noise (0.0 to 1.0)
  function posNoise(x, y, seed = 1) {
    const sinVal = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453);
    return sinVal - Math.floor(sinVal);
  }

  /* =====================================================
     HERO — Smooth 100% full-width ribbons
     - ZERO dark green dots in green or lime bands
     - ZERO right-side cutoff (cached canvas sizing prevents layout thrashing)
     ===================================================== */
  function drawHero() {
    const canvas = document.getElementById("heroPixels");
    if (!canvas) return;
    const { ctx, w, h } = fitCanvas(canvas);
    const cell = Math.max(7, Math.min(13, w / 150));
    const cols = Math.ceil(w / cell) + 12; // Extend past right border
    const rows = Math.ceil(h / cell) + 4;
    const t = performance.now() * 0.00018;
    const scrollShift = Math.min(1, window.scrollY / Math.max(1, h * 1.15));

    ctx.clearRect(0, 0, w, h);

    for (let x = 0; x < cols; x++) {
      const px = x * cell;
      const nx = px / w;

      // Smooth continuous band curves extending edge-to-edge
      const y1 = h * 0.22 + Math.sin(nx * 3.8 + t * 0.8) * h * 0.12 + Math.cos(nx * 7.5 - t * 0.6) * h * 0.04;
      const y2 = y1 + h * 0.20 + Math.sin(nx * 3.2 - 0.6 + t * 0.7) * h * 0.05;
      const y3 = y2 + h * 0.22 + Math.sin(nx * 4.5 + 1.0 - t * 0.9) * h * 0.04;

      const thick1 = h * 0.15 * (1 - scrollShift * 0.25);
      const thick2 = h * 0.14 * (1 - scrollShift * 0.25);
      const thick3 = h * 0.18 * (1 - scrollShift * 0.25);

      for (let y = 0; y < rows; y++) {
        const py = y * cell;
        const r = posNoise(x, y, 1407);

        const d1 = Math.abs(py - y1);
        const d2 = Math.abs(py - y2);
        const d3 = Math.abs(py - y3);

        // Find closest band to prevent cross-layer fallthrough contamination
        let color = null;

        if (d3 <= d1 && d3 <= d2) {
          // Belongs to Lime band
          if (d3 < thick3 && r > 0.08 + scrollShift * 0.15) {
            color = COLORS.lime;
          }
        } else if (d2 <= d1) {
          // Belongs to Green band
          if (d2 < thick2 && r > 0.08 + scrollShift * 0.15) {
            color = COLORS.green;
          }
        } else {
          // Belongs to Forest Green band
          if (d1 < thick1 && r > 0.08 + scrollShift * 0.15) {
            color = COLORS.forest;
          }
        }

        if (color) {
          ctx.globalAlpha = 0.78 + posNoise(x, y, 99) * 0.22;
          ctx.fillStyle = color;
          ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function heroLoop() {
    drawHero();
    requestAnimationFrame(heroLoop);
  }

  /* =====================================================
     SCATTER — "Born fragmented. Made coherent."
     ===================================================== */
  function drawScatter() {
    const canvas = document.getElementById("scatterPixels");
    if (!canvas) return;
    const { ctx, w, h } = fitCanvas(canvas);
    const rect = canvas.parentElement.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
    const count = Math.floor(Math.min(220, w / 5));
    ctx.clearRect(0, 0, w, h);
    const colors = [COLORS.forest, COLORS.green, COLORS.lime];
    for (let i = 0; i < count; i++) {
      const r1 = posNoise(i, 1, 9042);
      const r2 = posNoise(i, 2, 9042);
      const baseX = r1 * w, baseY = r2 * h;
      const targetX = w * .35 + Math.sin(i * .55) * 110;
      const targetY = h * .55 + Math.cos(i * .37) * 80;
      const gather = Math.max(0, Math.min(1, (progress - .25) * 1.5));
      const x = baseX * (1 - gather) + targetX * gather;
      const y = baseY * (1 - gather) + targetY * gather;
      const s = 5 + Math.floor(r1 * 4);
      ctx.fillStyle = colors[Math.floor(r2 * colors.length)];
      ctx.globalAlpha = .58 + r1 * .4;
      ctx.fillRect(Math.round(x / s) * s, Math.round(y / s) * s, s - 1, s - 1);
    }
    ctx.globalAlpha = 1;
  }

  /* =====================================================
     LIFECYCLE — DNA DOUBLE HELIX WEAVE (Matching craft.wild.as)
     - NO orb/dot at bottom right
     ===================================================== */
  const lifecycleParticles = [];
  let lifecycleInitialized = false;

  function initLifecycleParticles(w) {
    lifecycleParticles.length = 0;
    const count = Math.min(1200, Math.floor(w * 0.9));
    for (let i = 0; i < count; i++) {
      lifecycleParticles.push({
        u: Math.random(),
        vOffset: (Math.random() - 0.5),
        strand: Math.random() < 0.5 ? 0 : 1,
        isRung: Math.random() < 0.18,
        speed: 0.0009 + Math.random() * 0.0012,
        size: 5 + (Math.random() < 0.25 ? 1 : 0),
        seed: Math.random(),
      });
    }
    lifecycleInitialized = true;
  }

  function drawLifecycleFlow() {
    const canvas = document.getElementById("lifecyclePixels");
    if (!canvas) return;
    const { ctx, w, h } = fitCanvas(canvas);

    if (!lifecycleInitialized || Math.abs(lifecycleParticles.length - Math.min(1200, Math.floor(w * 0.9))) > 50) {
      initLifecycleParticles(w);
    }

    const rect = canvas.getBoundingClientRect();
    const viewProgress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
    const t = performance.now() * 0.0018;

    ctx.clearRect(0, 0, w, h);

    const s = 6;
    const centerY = h * 0.5;

    for (const p of lifecycleParticles) {
      p.u += p.speed;
      if (p.u > 1.05) {
        p.u = -0.05;
        p.vOffset = (Math.random() - 0.5);
        p.strand = Math.random() < 0.5 ? 0 : 1;
      }

      const u = p.u;
      const x = u * w;
      let y = centerY;
      let color = COLORS.forest;

      if (u < 0.35) {
        const funnel = 1 - Math.pow(u / 0.35, 1.2);
        const spread = h * 0.38 * funnel + 18;
        y = centerY + p.vOffset * spread + Math.sin(u * 20 + t) * 8;
        color = p.seed < 0.65 ? COLORS.forest : COLORS.green;

      } else {
        const helixProgress = (u - 0.35) / 0.65;
        const amplitude = Math.min(h * 0.28, helixProgress * h * 0.32 + 10);
        const frequency = 14.0;
        const phase = helixProgress * frequency + t * 1.5;

        const upperY = centerY - Math.sin(phase) * amplitude;
        const lowerY = centerY + Math.sin(phase) * amplitude;

        if (p.isRung && Math.abs(Math.sin(phase)) > 0.2) {
          const rungT = p.seed;
          y = upperY + (lowerY - upperY) * rungT + (p.vOffset * 6);
          color = (phase % Math.PI < Math.PI / 2) ? COLORS.green : COLORS.lime;
        } else if (p.strand === 0) {
          y = upperY + (p.vOffset * 16);
          color = Math.sin(phase) > 0 ? COLORS.green : COLORS.lime;
        } else {
          y = lowerY + (p.vOffset * 16);
          color = Math.sin(phase) > 0 ? COLORS.lime : COLORS.green;
        }
      }

      const gx = Math.round(x / s) * s;
      const gy = Math.round(y / s) * s;

      const alpha = 0.60 + (p.seed * 0.40);
      ctx.globalAlpha = alpha * Math.min(1, viewProgress * 2.2);
      ctx.fillStyle = color;
      ctx.fillRect(gx, gy, s - 1, s - 1);
    }

    ctx.globalAlpha = 1;
  }

  /* =====================================================
     PROTOCOL — "The twin is not a summary. It is the operating state."
     ===================================================== */
  const protocolParticles = [];
  let protocolInitialized = false;

  function initProtocolParticles(w, h) {
    protocolParticles.length = 0;
    const cols = Math.floor(w / 14);
    const rows = Math.floor(h / 14);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() < 0.45) {
          protocolParticles.push({
            gridX: c,
            gridY: r,
            nx: c / cols,
            ny: r / rows,
            phase: Math.random() * Math.PI * 2,
            speed: 0.5 + Math.random() * 1.2,
            colorIdx: Math.floor(Math.random() * 3),
            size: 5 + (Math.random() < 0.2 ? 1 : 0),
          });
        }
      }
    }
    protocolInitialized = true;
  }

  function drawProtocolFlow() {
    const canvas = document.getElementById("protocolPixels");
    if (!canvas) return;
    const { ctx, w, h } = fitCanvas(canvas);

    if (!protocolInitialized) {
      initProtocolParticles(w, h);
    }

    const rect = canvas.getBoundingClientRect();
    const viewProgress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
    const t = performance.now() * 0.0015;

    ctx.clearRect(0, 0, w, h);

    const s = 7;

    for (const p of protocolParticles) {
      const nx = p.nx;
      const ny = p.ny;

      const wave1 = Math.sin(nx * 8.0 + ny * 4.0 + t * 1.4);
      const wave2 = Math.cos(nx * 12.0 - ny * 6.0 + t * 1.8);
      const pulse = Math.sin(nx * 5.0 - t * 2.0 + p.phase) * 0.5 + 0.5;

      const baseX = nx * w;
      const baseY = ny * h * 0.65 + h * 0.18 + (wave1 * 18 + wave2 * 12);

      const gx = Math.round(baseX / s) * s;
      const gy = Math.round(baseY / s) * s;

      const alpha = 0.30 + pulse * 0.65;
      const color = pulse > 0.7 ? COLORS.lime : (pulse > 0.4 ? COLORS.green : COLORS.forest);

      ctx.globalAlpha = alpha * Math.min(1, viewProgress * 2.5);
      ctx.fillStyle = color;
      ctx.fillRect(gx, gy, s - 1, s - 1);
    }

    ctx.globalAlpha = 1;
  }

  /* =====================================================
     ANIMATION LOOPS
     ===================================================== */
  const lifecycle = document.getElementById("lifecyclePixels");
  const protocol = document.getElementById("protocolPixels");

  function renderScrollCanvases() {
    drawScatter();
  }

  function flowLoop() {
    if (lifecycle) drawLifecycleFlow();
    if (protocol) drawProtocolFlow();
    requestAnimationFrame(flowLoop);
  }

  // Pixel cursor
  const cursor = document.getElementById("pixelCursor");
  let mx = -100, my = -100, cx = -100, cy = -100;
  window.addEventListener("mousemove", e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.opacity = "1";
  });
  window.addEventListener("mouseleave", () => cursor.style.opacity = "0");
  function cursorLoop() {
    cx += (mx - cx) * .18; cy += (my - cy) * .18;
    cursor.style.transform = `translate(${cx - 24}px,${cy - 24}px) rotate(${Math.sin(performance.now() / 500) * 3}deg)`;
    requestAnimationFrame(cursorLoop);
  }

  // Horizontal work rail
  const rail = document.getElementById("caseRail");
  if (rail) {
    rail.addEventListener("wheel", e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        rail.scrollLeft += e.deltaY * .85;
      }
    }, { passive: true });
  }

  // Editorial section entrances
  const revealables = document.querySelectorAll(".case-card,.face-block,.lifecycle-steps>div,.proof-rail article,.level-row");
  revealables.forEach(el => el.style.opacity = ".18");
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.animate([
          { opacity: .18, transform: "translateY(18px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 540, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" });
        io.unobserve(entry.target);
      }
    })
  }, { threshold: .18 });
  revealables.forEach(el => io.observe(el));

  let scrollTick = false;
  window.addEventListener("scroll", () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      renderScrollCanvases();
      scrollTick = false;
    });
  }, { passive: true });

  window.addEventListener("resize", () => {
    drawHero();
    renderScrollCanvases();
    lifecycleInitialized = false;
    protocolInitialized = false;
  });

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    heroLoop();
    flowLoop();
    cursorLoop();
  } else {
    drawHero();
    if (lifecycle) drawLifecycleFlow();
    if (protocol) drawProtocolFlow();
  }
  renderScrollCanvases();
})();

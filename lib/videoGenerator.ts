/**
 * lib/videoGenerator.ts
 * ----------------------
 * All canvas animation and MediaRecorder logic lives here.
 *
 * Supports 4 distinct visual animation templates:
 *   - cosmic: Deep space, nebula galaxy, starlight glow
 *   - neon: Cyberpunk synthwave, glowing perspective grid, electric neon
 *   - golden: Regal obsidian, champagne bokeh, luxury gold leaf
 *   - pastel: Joyful candy clouds, pastel balloons, party confetti
 *
 * The pipeline:
 *   Canvas Animation → canvas.captureStream(30) → MediaRecorder → Blob → Object URL
 */

import { getTemplateById, AnimationTemplateId, AnimationTemplate } from "./templates";

export interface GeneratorOptions {
  name: string;
  formattedDate: string;
  age: number;
  templateId?: AnimationTemplateId;
}

export interface VideoResult {
  blob: Blob;
  extension: string;   // "webm"
  mimeType: string;    // e.g. "video/webm;codecs=vp9"
}

/** Progress callback: called with 0–100 as video renders. */
export type ProgressCallback = (percent: number) => void;

// ─── MIME Type Detection ──────────────────────────────────────────────────────

function getSupportedMimeType(): { mimeType: string; extension: string } | null {
  if (typeof window === "undefined" || !("MediaRecorder" in window)) return null;

  const candidates = [
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm",            extension: "webm" },
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }
  return null;
}

// ─── Canvas Constants & Geometry Helpers ──────────────────────────────────────

const W = 1280;
const H = 720;

function radialGrad(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  inner: string, outer: string
): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  return g;
}

function linearGrad(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  stops: [number, string][]
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([offset, color]) => g.addColorStop(offset, color));
  return g;
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/**
 * Robustly converts any 3, 4, 6, or 8 digit hex color or rgb string to rgba(r, g, b, alpha).
 * Completely eliminates canvas color syntax errors like '#FFF55'.
 */
function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`;
  if (hex.startsWith("rgba")) {
    return hex.replace(/[\d\.]+\)$/g, `${alpha})`);
  }
  if (hex.startsWith("rgb")) {
    return hex.replace("rgb", "rgba").replace(")", `, ${alpha})`);
  }

  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  } else if (clean.length === 4) {
    clean = clean.slice(0, 3).split("").map((c) => c + c).join("");
  } else if (clean.length > 6) {
    clean = clean.slice(0, 6);
  }

  const r = parseInt(clean.slice(0, 2), 16) || 255;
  const g = parseInt(clean.slice(2, 4), 16) || 255;
  const b = parseInt(clean.slice(4, 6), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Particles, Bokeh & Stars ─────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  alpha: number;
  shape: "circle" | "star" | "rect" | "spark";
  rotation: number;
  rotSpeed: number;
}

interface BokehCircle {
  x: number; y: number;
  r: number;
  alpha: number;
  vy: number;
  color: string;
}

interface Star {
  x: number; y: number;
  r: number;
  twinkle: number;
  phase: number;
}

interface Balloon {
  x: number; y: number;
  vy: number; vx: number;
  color: string;
  size: number;
  phase: number;
}

function createParticles(count: number, colors: string[], fromTop = false): Particle[] {
  const shapes: Array<"circle" | "star" | "rect" | "spark"> = ["circle", "star", "rect", "spark"];
  return Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: fromTop ? Math.random() * -100 : Math.random() * H,
    vx: (Math.random() - 0.5) * 3,
    vy: fromTop ? Math.random() * 4 + 1 : (Math.random() - 0.3) * 2,
    size: Math.random() * 10 + 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: Math.random() * 0.6 + 0.4,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.2,
  }));
}

function updateParticles(particles: Particle[], gravity = 0.05) {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += gravity;
    p.rotation += p.rotSpeed;
    if (p.y > H + 20) {
      p.y = -20;
      p.x = Math.random() * W;
    }
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);

  if (p.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === "rect") {
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  } else if (p.shape === "spark") {
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.lineTo(p.size / 3, 0);
    ctx.lineTo(0, p.size);
    ctx.lineTo(-p.size / 3, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    // 5-point star
    const outerR = p.size / 2;
    const innerR = p.size / 4;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 2.2 + 0.6,
    twinkle: Math.random() * 0.5 + 0.5,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], time: number, alpha = 1) {
  for (const s of stars) {
    const a = s.twinkle * (0.5 + 0.5 * Math.sin(time * 2.5 + s.phase));
    ctx.save();
    ctx.globalAlpha = a * alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function createBokeh(count: number, colors: string[]): BokehCircle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 50 + 20,
    alpha: Math.random() * 0.25 + 0.08,
    vy: -(Math.random() * 0.6 + 0.2),
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
}

function drawBokeh(ctx: CanvasRenderingContext2D, bokeh: BokehCircle[], time: number) {
  for (const b of bokeh) {
    b.y += b.vy;
    if (b.y < -b.r) b.y = H + b.r;
    ctx.save();
    ctx.globalAlpha = b.alpha * (0.8 + 0.2 * Math.sin(time + b.x));
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    grad.addColorStop(0, hexToRgba(b.color, 0.9));
    grad.addColorStop(0.6, hexToRgba(b.color, 0.35));
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function createBalloons(count: number, colors: string[]): Balloon[] {
  return Array.from({ length: count }, (_, i) => ({
    x: (W / count) * i + W / count / 2 + (Math.random() - 0.5) * 60,
    y: H + 80 + Math.random() * 100,
    vy: -(Math.random() * 1.6 + 0.9),
    vx: (Math.random() - 0.5) * 0.6,
    color: colors[i % colors.length],
    size: Math.random() * 20 + 38,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawBalloon(ctx: CanvasRenderingContext2D, b: Balloon, time: number, alpha: number) {
  const sway = Math.sin(time * 1.6 + b.phase) * 10;
  const cx = b.x + sway;
  const cy = b.y;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Balloon body
  ctx.beginPath();
  ctx.ellipse(cx, cy, b.size * 0.72, b.size, 0, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx - b.size * 0.25, cy - b.size * 0.3, 0, cx, cy, b.size);
  grad.addColorStop(0, "rgba(255,255,255,0.7)");
  grad.addColorStop(0.3, b.color);
  grad.addColorStop(1, hexToRgba(b.color, 0.6));
  ctx.fillStyle = grad;
  ctx.fill();

  // Highlight
  ctx.beginPath();
  ctx.ellipse(cx - b.size * 0.3, cy - b.size * 0.4, b.size * 0.15, b.size * 0.3, -Math.PI / 6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fill();

  // Knot
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + b.size);
  ctx.lineTo(cx + 5, cy + b.size);
  ctx.lineTo(cx, cy + b.size + 8);
  ctx.closePath();
  ctx.fillStyle = b.color;
  ctx.fill();

  // String
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.5;
  ctx.moveTo(cx, cy + b.size + 8);
  ctx.quadraticCurveTo(cx + 15, cy + b.size + 35, cx - 8, cy + b.size + 70);
  ctx.stroke();

  ctx.restore();
}

// ─── Theme-Specific Ambient Renderers ─────────────────────────────────────────

/** Renders animated synthwave perspective grid for Neon theme */
function drawNeonGrid(ctx: CanvasRenderingContext2D, time: number, alpha: number) {
  if (alpha <= 0) return;
  const horizonY = H * 0.58;
  const vpX = W / 2;

  ctx.save();
  ctx.globalAlpha = alpha * 0.4;
  ctx.strokeStyle = "#00F2FE";
  ctx.lineWidth = 1.2;

  // Perspective vertical lines converging to vanishing point
  const totalLines = 24;
  for (let i = -totalLines / 2; i <= totalLines / 2; i++) {
    const bottomX = vpX + i * 80;
    ctx.beginPath();
    ctx.moveTo(vpX, horizonY);
    ctx.lineTo(bottomX, H);
    ctx.stroke();
  }

  // Moving horizontal grid lines
  const speed = (time * 1.8) % 1;
  const numHoriz = 10;
  for (let j = 0; j < numHoriz; j++) {
    const p = (j + speed) / numHoriz;
    const y = horizonY + Math.pow(p, 2.2) * (H - horizonY);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Horizon glowing bar
  const horizGlow = linearGrad(ctx, 0, horizonY - 10, 0, horizonY + 10, [
    [0, "transparent"],
    [0.5, "#FF007F"],
    [1, "transparent"],
  ]);
  ctx.fillStyle = horizGlow;
  ctx.fillRect(0, horizonY - 15, W, 30);

  ctx.restore();
}

/** Renders luxury filigree border for Golden theme */
function drawLuxuryBorder(ctx: CanvasRenderingContext2D, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.35;
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 2;

  const m = 35;
  ctx.strokeRect(m, m, W - m * 2, H - m * 2);

  // Inner thin border
  ctx.lineWidth = 0.8;
  const m2 = 43;
  ctx.strokeRect(m2, m2, W - m2 * 2, H - m2 * 2);

  // Corner ornaments
  const corners = [
    [m, m], [W - m, m], [m, H - m], [W - m, H - m]
  ];
  corners.forEach(([cx, cy]) => {
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

/** Renders soft fluffy pastel clouds for Pastel theme */
function drawPastelClouds(ctx: CanvasRenderingContext2D, time: number, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.15;
  ctx.fillStyle = "#FFFFFF";

  const sway = Math.sin(time * 0.8) * 20;
  // Left cloud puff
  ctx.beginPath();
  ctx.arc(120 + sway, H - 40, 100, 0, Math.PI * 2);
  ctx.arc(220 + sway, H - 70, 90, 0, Math.PI * 2);
  ctx.arc(320 + sway, H - 30, 80, 0, Math.PI * 2);
  ctx.fill();

  // Right cloud puff
  ctx.beginPath();
  ctx.arc(W - 140 - sway, H - 50, 110, 0, Math.PI * 2);
  ctx.arc(W - 250 - sway, H - 80, 85, 0, Math.PI * 2);
  ctx.arc(W - 350 - sway, H - 40, 75, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Themed Cake Drawer ───────────────────────────────────────────────────────

function drawCake(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  scale: number,
  time: number,
  template: AnimationTemplate
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const isNeon = template.id === "neon";
  const isGolden = template.id === "golden";
  const isPastel = template.id === "pastel";

  // Tier Colors
  const bottomColor = isNeon ? "#100028" : isGolden ? "#2a1c07" : isPastel ? "#FD79A8" : "#FF6B6B";
  const topColor = isNeon ? "#200045" : isGolden ? "#3d2b0e" : isPastel ? "#4ECDC4" : "#A29BFE";
  const frostColor = isGolden ? "#FFD700" : isNeon ? "#00F2FE" : "#FFFFFF";

  // Bottom tier
  ctx.fillStyle = bottomColor;
  ctx.beginPath();
  ctx.roundRect(-85, 20, 170, 60, 10);
  ctx.fill();
  if (isNeon || isGolden) {
    ctx.strokeStyle = template.accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Frosting bottom
  ctx.fillStyle = frostColor;
  ctx.beginPath();
  ctx.ellipse(0, 20, 85, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Top tier
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.roundRect(-60, -42, 120, 62, 10);
  ctx.fill();
  if (isNeon || isGolden) {
    ctx.strokeStyle = template.colors.secondary;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Frosting top
  ctx.fillStyle = frostColor;
  ctx.beginPath();
  ctx.ellipse(0, -42, 60, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Candles
  const candlePositions = [-32, 0, 32];
  candlePositions.forEach((x, idx) => {
    const candleColor = isNeon
      ? idx % 2 === 0 ? "#FF007F" : "#00F2FE"
      : isGolden ? "#FFEAA7" : "#FFE66D";

    ctx.fillStyle = candleColor;
    ctx.fillRect(x - 4, -84, 8, 42);

    // Flame flicker
    const flicker = Math.sin(time * 9 + x) * 3;
    const flameColor = isNeon ? "#00F2FE" : "#FFE66D";
    const grad = ctx.createRadialGradient(x, -86 + flicker, 0, x, -86, 14);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(0.4, flameColor);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, -92 + flicker, 7, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

// ─── Glow Text Helper ─────────────────────────────────────────────────────────

function drawGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: string,
  color: string,
  glowColor: string,
  glowSize: number,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Outer glow pass
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowSize;
  ctx.fillStyle = glowColor;
  ctx.fillText(text, W / 2, y);

  // Inner glow pass for richness
  ctx.shadowBlur = glowSize / 2;
  ctx.fillText(text, W / 2, y);

  // Crisp text on top
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

// ─── Scene Renderers ──────────────────────────────────────────────────────────

interface SharedState {
  stars: Star[];
  particles: Particle[];
  balloons: Balloon[];
  bokeh: BokehCircle[];
  time: number;
}

/** Draws template base background */
function renderThemeBackground(
  ctx: CanvasRenderingContext2D,
  template: AnimationTemplate,
  state: SharedState
) {
  const { stars, particles, balloons, bokeh, time } = state;
  const { bgDark, bgLight, glow } = template.colors;

  // Gradient base
  ctx.fillStyle = linearGrad(ctx, 0, 0, W, H, [
    [0, bgDark],
    [0.5, bgLight],
    [1, bgDark],
  ]);
  ctx.fillRect(0, 0, W, H);

  // Center radial glow
  const centerGlow = radialGrad(ctx, W / 2, H / 2, 0, hexToRgba(glow, 0.2), "transparent");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, W, H);

  // Template specific background features
  if (template.id === "cosmic") {
    drawStars(ctx, stars, time, 0.85);
  } else if (template.id === "neon") {
    drawNeonGrid(ctx, time, 0.7);
    drawStars(ctx, stars, time, 0.4);
  } else if (template.id === "golden") {
    drawBokeh(ctx, bokeh, time);
    drawLuxuryBorder(ctx, 0.8);
  } else if (template.id === "pastel") {
    drawPastelClouds(ctx, time, 0.8);
    drawStars(ctx, stars, time, 0.5);
  }

  // Draw floating particles
  particles.forEach((p) => drawParticle(ctx, p));

  // Draw balloons if applicable
  if (template.id !== "golden") {
    balloons.forEach((b) => drawBalloon(ctx, b, time, 0.5));
  }
}

/** Scene 1: Mysterious Entrance & Reveal */
function renderScene1(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions,
  template: AnimationTemplate
) {
  renderThemeBackground(ctx, template, state);

  // Pulsing energy rings
  for (let i = 0; i < 3; i++) {
    const ringT = ((state.time * 0.4 + i * 0.33) % 1);
    const ringR = ringT * 420;
    const ringAlpha = (1 - ringT) * 0.2;
    ctx.save();
    ctx.globalAlpha = ringAlpha * smoothstep(t * 3);
    ctx.strokeStyle = template.accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const textAlpha = smoothstep((t - 0.2) * 3);
  if (textAlpha > 0) {
    const titleText =
      template.id === "neon"
        ? "⚡ A SPECIAL DAY HAS ARRIVED ⚡"
        : template.id === "golden"
        ? "✨ An Extraordinary Occasion ✨"
        : template.id === "pastel"
        ? "🎈 A Very Special Day Is Here! 🎈"
        : "✨ A Special Day Is Here... ✨";

    drawGlowText(
      ctx,
      titleText,
      H / 2,
      "bold 54px Georgia, serif",
      "#FFFFFF",
      template.accentColor,
      35,
      textAlpha
    );
  }
}

/** Scene 2: Thematic Birthday Cake & Decor */
function renderScene2(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions,
  template: AnimationTemplate
) {
  renderThemeBackground(ctx, template, state);

  // Cake zooms and settles
  const cakeScale = smoothstep((t - 0.15) * 3.5);
  if (cakeScale > 0) {
    drawCake(ctx, W / 2, H / 2 + 50, cakeScale * 1.15, state.time, template);
  }

  // Heading text
  const textAlpha = smoothstep((t - 0.45) * 4);
  const subtitle =
    template.id === "neon"
      ? "🎂 POWERING UP BIRTHDAY MAGIC 🎂"
      : template.id === "golden"
      ? "👑 Celebrating in Grand Style 👑"
      : template.id === "pastel"
      ? "🍰 Let The Sweet Celebrations Begin! 🍰"
      : "🎂 Something Wonderful Awaits... 🎂";

  drawGlowText(
    ctx,
    subtitle,
    H * 0.18,
    "bold 42px Georgia, serif",
    template.colors.secondary,
    template.accentColor,
    25,
    textAlpha
  );
}

/** Scene 3: Spotlight Person's Name Reveal */
function renderScene3(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions,
  template: AnimationTemplate
) {
  renderThemeBackground(ctx, template, state);

  // Lead-in line
  const leadAlpha = smoothstep(t * 3.5);
  drawGlowText(
    ctx,
    "Today we celebrate the one and only...",
    H * 0.28,
    "italic 38px Georgia, serif",
    template.colors.secondary,
    template.accentColor,
    20,
    leadAlpha
  );

  // Hero Name
  const nameT = smoothstep((t - 0.15) * 3);
  const floatY = Math.sin(state.time * 1.8) * 12;
  const nameScale = lerp(0.3, 1.05, nameT);

  if (nameT > 0) {
    ctx.save();
    ctx.globalAlpha = nameT;
    ctx.translate(W / 2, H / 2 + floatY);
    ctx.scale(nameScale, nameScale);
    ctx.translate(-W / 2, -(H / 2 + floatY));

    ctx.font = "bold 118px 'Dancing Script', Georgia, cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Glow layers
    ctx.shadowColor = template.accentColor;
    ctx.shadowBlur = 55;
    ctx.fillStyle = template.accentColor;
    ctx.fillText(opts.name, W / 2, H / 2 + floatY);

    ctx.shadowColor = template.colors.secondary;
    ctx.shadowBlur = 20;
    ctx.fillText(opts.name, W / 2, H / 2 + floatY);

    // Front crisp gradient
    ctx.shadowBlur = 0;
    const nameGrad = linearGrad(ctx, W / 2 - 250, 0, W / 2 + 250, 0, [
      [0, template.colors.secondary],
      [0.5, "#FFFFFF"],
      [1, template.accentColor],
    ]);
    ctx.fillStyle = nameGrad;
    ctx.fillText(opts.name, W / 2, H / 2 + floatY);

    ctx.restore();
  }
}

/** Scene 4: Hero Celebration Headline & Big Name */
function renderScene4(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions,
  template: AnimationTemplate
) {
  renderThemeBackground(ctx, template, state);

  // Headline
  const line1Alpha = smoothstep(t * 4);
  drawGlowText(
    ctx,
    "🎉 Happy Birthday, 🎉",
    H * 0.26,
    "bold 56px Georgia, serif",
    template.colors.secondary,
    template.accentColor,
    30,
    line1Alpha
  );

  // Giant pulsing name
  const nameT = smoothstep((t - 0.1) * 3.5);
  const pulse = 1 + Math.sin(state.time * 3.2) * 0.04;
  if (nameT > 0) {
    ctx.save();
    ctx.globalAlpha = nameT;
    ctx.translate(W / 2, H / 2 + 5);
    ctx.scale(pulse, pulse);
    ctx.translate(-W / 2, -(H / 2 + 5));

    ctx.font = "bold 115px 'Dancing Script', Georgia, cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Triple glow pass
    [template.accentColor, template.colors.secondary, "#FFFFFF"].forEach((c, i) => {
      ctx.shadowColor = c;
      ctx.shadowBlur = 45 - i * 15;
      ctx.fillStyle = hexToRgba(c, 0.33);
      ctx.fillText(opts.name + "!", W / 2, H / 2 + 5);
    });

    ctx.shadowBlur = 0;
    const heroGrad = linearGrad(ctx, W / 2 - 320, 0, W / 2 + 320, 0, [
      [0, template.accentColor],
      [0.3, template.colors.secondary],
      [0.7, "#FFFFFF"],
      [1, template.accentColor],
    ]);
    ctx.fillStyle = heroGrad;
    ctx.fillText(opts.name + "!", W / 2, H / 2 + 5);

    ctx.restore();
  }

  // Row of celebratory emojis
  const emojiAlpha = smoothstep((t - 0.35) * 3);
  const emojis =
    template.id === "neon"
      ? "⚡ 🚀 🎂 🎁 🕹️ 🥳"
      : template.id === "golden"
      ? "👑 🥂 🎂 🌟 🎁 🍾"
      : template.id === "pastel"
      ? "🎈 🍭 🎂 💖 🎁 🥳"
      : "🎂 🎈 🥳 🎁 ✨ 🎊";

  drawGlowText(ctx, emojis, H * 0.77, "50px Arial", "#FFFFFF", "#FFFFFF", 6, emojiAlpha);
}

/** Scene 5: Milestone Card & Personal Details */
function renderScene5(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions,
  template: AnimationTemplate
) {
  renderThemeBackground(ctx, template, state);

  // Translucent backdrop card
  const cardAlpha = smoothstep(t * 3.5);
  ctx.save();
  ctx.globalAlpha = cardAlpha * 0.22;
  ctx.fillStyle = "#FFFFFF";
  const cardW = 820, cardH = 360;
  const cardX = (W - cardW) / 2, cardY = (H - cardH) / 2;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24);
  ctx.fill();

  ctx.globalAlpha = cardAlpha * 0.6;
  ctx.strokeStyle = template.accentColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Three staggered lines
  const t1 = smoothstep(t * 3.5);
  const t2 = smoothstep((t - 0.2) * 3.5);
  const t3 = smoothstep((t - 0.45) * 3.5);

  drawGlowText(
    ctx,
    `🎂 Born on ${opts.formattedDate}`,
    H / 2 - 85,
    "bold 42px Georgia, serif",
    template.colors.secondary,
    template.accentColor,
    20,
    t1
  );

  drawGlowText(
    ctx,
    `Turning ${opts.age} — What an Incredible Milestone! 🎉`,
    H / 2,
    "bold 44px Georgia, serif",
    "#FFFFFF",
    template.accentColor,
    25,
    t2
  );

  drawGlowText(
    ctx,
    "May your upcoming year be overflowing with joy & triumphs! ❤️",
    H / 2 + 85,
    "italic 32px Georgia, serif",
    template.colors.secondary,
    template.accentColor,
    15,
    t3
  );
}

/** Scene 6: Grand Finale & Celebratory Farewell */
function renderScene6(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions,
  template: AnimationTemplate
) {
  renderThemeBackground(ctx, template, state);

  // Orbiting sparkle rings
  for (let i = 0; i < 8; i++) {
    const angle = (state.time * 0.45 + i / 8) * Math.PI * 2;
    const r = 240 + Math.sin(state.time * 2 + i) * 35;
    const sx = W / 2 + Math.cos(angle) * r;
    const sy = H / 2 + Math.sin(angle) * r * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(state.time * 3 + i);
    ctx.fillStyle = template.colors.confetti[i % template.colors.confetti.length];
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const t1 = smoothstep(t * 3);
  const t2 = smoothstep((t - 0.25) * 3);
  const t3 = smoothstep((t - 0.5) * 3.5);

  const pulse = 1 + Math.sin(state.time * 3.5) * 0.04;
  ctx.save();
  ctx.translate(W / 2, H / 2 - 60);
  ctx.scale(pulse, pulse);
  ctx.translate(-W / 2, -(H / 2 - 60));
  drawGlowText(
    ctx,
    "🎉 Have an Amazing Birthday! 🎉",
    H / 2 - 60,
    "bold 60px Georgia, serif",
    template.colors.secondary,
    template.accentColor,
    35,
    t1
  );
  ctx.restore();

  drawGlowText(
    ctx,
    "May all your highest dreams come true! 🌟",
    H / 2 + 30,
    "italic 38px Georgia, serif",
    "#FFFFFF",
    template.accentColor,
    20,
    t2
  );

  drawGlowText(
    ctx,
    "With Love & Best Wishes ❤️",
    H / 2 + 110,
    "bold 36px Georgia, serif",
    template.colors.secondary,
    template.accentColor,
    15,
    t3
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * generateBirthdayVideo
 * ----------------------
 * Renders a 6-scene themed birthday animation on an offscreen Canvas,
 * records it via MediaRecorder, and resolves with the resulting Blob.
 */
export async function generateBirthdayVideo(
  opts: GeneratorOptions,
  onProgress: ProgressCallback
): Promise<VideoResult> {
  const mimeInfo = getSupportedMimeType();
  if (!mimeInfo) {
    throw new Error("Your browser does not support video recording. Please use Chrome, Edge, or Firefox.");
  }
  const { mimeType: recordingMimeType, extension: recordingExtension } = mimeInfo;

  const template = getTemplateById(opts.templateId || "cosmic");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: recordingMimeType,
    videoBitsPerSecond: 4_500_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const FPS = 30;
  const scenes: Array<{
    fn: (
      ctx: CanvasRenderingContext2D,
      t: number,
      state: SharedState,
      opts: GeneratorOptions,
      template: AnimationTemplate
    ) => void;
    duration: number;
  }> = [
    { fn: renderScene1, duration: 3 },
    { fn: renderScene2, duration: 3.5 },
    { fn: renderScene3, duration: 3 },
    { fn: renderScene4, duration: 4.5 },
    { fn: renderScene5, duration: 3 },
    { fn: renderScene6, duration: 3.5 },
  ];
  const totalFrames = scenes.reduce((s, sc) => s + sc.duration * FPS, 0);

  const state: SharedState = {
    stars: createStars(110),
    particles: createParticles(75, template.colors.confetti, true),
    balloons: createBalloons(8, template.colors.confetti),
    bokeh: createBokeh(28, template.colors.confetti),
    time: 0,
  };

  return new Promise<VideoResult>((resolve, reject) => {
    recorder.start();

    let globalFrame = 0;
    let sceneIndex = 0;
    let sceneFrame = 0;

    function renderNextFrame() {
      try {
        if (sceneIndex >= scenes.length) {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: recordingMimeType });
            resolve({ blob, extension: recordingExtension, mimeType: recordingMimeType });
          };
          recorder.stop();
          return;
        }

        const scene = scenes[sceneIndex];
        const sceneTotalFrames = scene.duration * FPS;
        const t = sceneFrame / sceneTotalFrames;

        state.time = globalFrame / FPS;
        updateParticles(state.particles, 0.06);
        state.balloons.forEach((b) => {
          b.x += b.vx;
          b.y += b.vy;
          if (b.y < -100) {
            b.y = H + 80;
            b.x = Math.random() * W;
          }
        });

        scene.fn(ctx, t, state, opts, template);

        sceneFrame++;
        globalFrame++;

        if (sceneFrame >= sceneTotalFrames) {
          sceneIndex++;
          sceneFrame = 0;
        }

        onProgress(Math.round((globalFrame / totalFrames) * 100));

        setTimeout(renderNextFrame, 1000 / FPS);
      } catch (err) {
        recorder.stop();
        reject(err);
      }
    }

    renderNextFrame();
  });
}

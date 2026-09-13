/**
 * lib/videoGenerator.ts
 * ----------------------
 * All canvas animation and MediaRecorder logic lives here.
 *
 * The pipeline:
 *   Canvas Animation → canvas.captureStream() → MediaRecorder → Blob chunks → Blob → Object URL
 *
 * Why canvas + MediaRecorder?
 *   MediaRecorder is the only browser-native way to record live canvas animation
 *   into a real video file without server-side processing or WASM libraries.
 *   The output is WebM (VP8/VP9), which is widely supported for playback and download.
 *
 * Why not MP4?
 *   MediaRecorder cannot produce MP4 reliably in any major browser without WASM encoders.
 *   We detect the best supported MIME type at runtime instead of assuming a fixed format.
 */

export interface GeneratorOptions {
  name: string;
  formattedDate: string;
  age: number;
}

export interface VideoResult {
  blob: Blob;
  extension: string;   // "webm" — the actual file extension to use in download
  mimeType: string;    // e.g. "video/webm;codecs=vp9"
}

/** Progress callback: called with 0–100 as video renders. */
export type ProgressCallback = (percent: number) => void;

// ─── MIME Type Detection ──────────────────────────────────────────────────────

/**
 * Finds the best MediaRecorder MIME type supported by the current browser.
 * Returns null if MediaRecorder itself isn't supported at all.
 */
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

// ─── Canvas Helpers ───────────────────────────────────────────────────────────

const W = 1280;
const H = 720;

/** Creates a radial gradient covering the full canvas. */
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

/** Creates a linear gradient across the canvas. */
function linearGrad(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  stops: [number, string][]
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([offset, color]) => g.addColorStop(offset, color));
  return g;
}

/** Draws text centered horizontally at a given y position. */
function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.fillText(text, W / 2, y);
}

/** Clamps a value between 0 and 1. */
function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** Linear interpolation: t=0 → a, t=1 → b */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

/** Easing: smooth-step (S-curve) for a more natural look */
function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

// ─── Particle System ──────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  alpha: number;
  shape: "circle" | "star" | "rect";
  rotation: number;
  rotSpeed: number;
}

const CONFETTI_COLORS = [
  "#FF6B6B", "#FFE66D", "#4ECDC4", "#A29BFE",
  "#FD79A8", "#FDCB6E", "#6C5CE7", "#00CEC9",
  "#FF7675", "#74B9FF", "#55EFC4", "#FFEAA7",
];

function createParticles(count: number, fromTop = false): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: fromTop ? Math.random() * -100 : Math.random() * H,
    vx: (Math.random() - 0.5) * 3,
    vy: fromTop ? Math.random() * 4 + 1 : (Math.random() - 0.3) * 2,
    size: Math.random() * 10 + 5,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    alpha: Math.random() * 0.6 + 0.4,
    shape: (["circle", "star", "rect"] as const)[Math.floor(Math.random() * 3)],
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
  } else {
    // 5-point star — 10 vertices alternating outer/inner radii
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

function drawAllParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  particles.forEach(p => drawParticle(ctx, p));
}

// ─── Star field ───────────────────────────────────────────────────────────────

interface Star { x: number; y: number; r: number; twinkle: number; phase: number }

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 2 + 0.5,
    twinkle: Math.random() * 0.5 + 0.5,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], time: number, alpha = 1) {
  for (const s of stars) {
    const a = s.twinkle * (0.5 + 0.5 * Math.sin(time * 2 + s.phase));
    ctx.save();
    ctx.globalAlpha = a * alpha;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Balloon Drawing ──────────────────────────────────────────────────────────

interface Balloon {
  x: number; y: number; vy: number; vx: number;
  color: string; size: number; phase: number;
}

const BALLOON_COLORS = ["#FF6B6B", "#FFE66D", "#4ECDC4", "#A29BFE", "#FD79A8", "#74B9FF"];

function createBalloons(count: number): Balloon[] {
  return Array.from({ length: count }, (_, i) => ({
    x: (W / count) * i + W / count / 2 + (Math.random() - 0.5) * 80,
    y: H + 80 + Math.random() * 100,
    vy: -(Math.random() * 1.5 + 0.8),
    vx: (Math.random() - 0.5) * 0.5,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    size: Math.random() * 20 + 40,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawBalloon(ctx: CanvasRenderingContext2D, b: Balloon, time: number, alpha: number) {
  const sway = Math.sin(time * 1.5 + b.phase) * 8;
  const cx = b.x + sway;
  const cy = b.y;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Balloon body
  ctx.beginPath();
  ctx.ellipse(cx, cy, b.size * 0.7, b.size, 0, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx - b.size * 0.2, cy - b.size * 0.3, 0, cx, cy, b.size);
  grad.addColorStop(0, "rgba(255,255,255,0.6)");
  grad.addColorStop(0.3, b.color);
  grad.addColorStop(1, b.color + "88");
  ctx.fillStyle = grad;
  ctx.fill();

  // String
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.moveTo(cx, cy + b.size);
  ctx.quadraticCurveTo(cx + 10, cy + b.size + 30, cx - 5, cy + b.size + 60);
  ctx.stroke();

  ctx.restore();
}

// ─── Cake Drawing ─────────────────────────────────────────────────────────────

function drawCake(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, time: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Bottom tier
  ctx.fillStyle = "#FF6B6B";
  ctx.beginPath();
  ctx.roundRect(-80, 20, 160, 60, 8);
  ctx.fill();

  // Frosting bottom
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, 20, 80, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Top tier
  ctx.fillStyle = "#A29BFE";
  ctx.beginPath();
  ctx.roundRect(-55, -40, 110, 60, 8);
  ctx.fill();

  // Frosting top
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, -40, 55, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Candles
  const candlePositions = [-30, 0, 30];
  candlePositions.forEach(x => {
    ctx.fillStyle = "#FFE66D";
    ctx.fillRect(x - 4, -80, 8, 40);

    // Flame flicker
    const flicker = Math.sin(time * 8 + x) * 3;
    const grad = ctx.createRadialGradient(x, -82 + flicker, 0, x, -82, 12);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(0.4, "#FFE66D");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, -88 + flicker, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

// ─── Glow Text ────────────────────────────────────────────────────────────────

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

  // Outer glow passes
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowSize;
  ctx.fillStyle = glowColor;
  ctx.fillText(text, W / 2, y);

  // Crisp text on top
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

// ─── Scene Renderers ──────────────────────────────────────────────────────────
// Each scene function receives a progress value t ∈ [0, 1] representing how far
// through that scene we are, plus any shared state (stars, particles, balloons).

interface SharedState {
  stars: Star[];
  particles: Particle[];
  balloons: Balloon[];
  time: number;
}

/** Scene 1: Dark starfield + particle entrance + "A Special Day Is Here..." */
function renderScene1(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions
) {
  const { stars, particles, time } = state;

  // Background: deep space gradient
  ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
    [0, "#0a0015"],
    [0.5, "#12003a"],
    [1, "#0d001f"],
  ]);
  ctx.fillRect(0, 0, W, H);

  // Nebula glow
  const nebula = radialGrad(ctx, W * 0.3, H * 0.4, 0, "rgba(108,92,231,0.3)", "transparent");
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, W, H);

  drawStars(ctx, stars, time, smoothstep(t * 3));
  drawAllParticles(ctx, particles);

  // Entrance text fade-in
  const textAlpha = smoothstep((t - 0.3) * 3);
  if (textAlpha > 0) {
    drawGlowText(ctx, "✨ A Special Day Is Here... ✨", H / 2, "bold 56px Georgia, serif",
      "#fff", "#A29BFE", 30, textAlpha);
  }

  void opts; // opts used in later scenes
}

/** Scene 2: Birthday decorations animate in */
function renderScene2(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  _opts: GeneratorOptions
) {
  const { stars, particles, balloons, time } = state;

  // Gradient background — warm purple/pink
  ctx.fillStyle = linearGrad(ctx, 0, 0, W, H, [
    [0, "#1a0040"],
    [0.5, "#2d0060"],
    [1, "#1a0040"],
  ]);
  ctx.fillRect(0, 0, W, H);

  const centerGlow = radialGrad(ctx, W / 2, H / 2, 0, "rgba(160,100,255,0.25)", "transparent");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, W, H);

  drawStars(ctx, stars, time, 0.6);
  drawAllParticles(ctx, particles);

  // Balloons rise from bottom
  const balloonAlpha = smoothstep(t * 2);
  balloons.forEach(b => drawBalloon(ctx, b, time, balloonAlpha));

  // Cake appears center
  const cakeScale = smoothstep((t - 0.3) * 3);
  if (cakeScale > 0) {
    drawCake(ctx, W / 2, H / 2 + 60, cakeScale * 1.1, time);
  }

  // "Get Ready..." text
  const textAlpha = smoothstep((t - 0.6) * 5);
  drawGlowText(ctx, "🎂 Something Special Awaits... 🎂", H * 0.18,
    "bold 42px Georgia, serif", "#FFE66D", "#FFD700", 20, textAlpha);
}

/** Scene 3: Name appears prominently with glow + float */
function renderScene3(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions
) {
  const { stars, particles, time } = state;

  // Rich midnight blue background
  ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
    [0, "#000428"],
    [0.5, "#004e92"],
    [1, "#000428"],
  ]);
  ctx.fillRect(0, 0, W, H);

  // Spotlight
  const spot = radialGrad(ctx, W / 2, H / 2, 0, "rgba(100,180,255,0.2)", "transparent");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  drawStars(ctx, stars, time, 0.8);
  drawAllParticles(ctx, particles);

  // "Today we celebrate" line
  const line1Alpha = smoothstep(t * 4);
  drawGlowText(ctx, "Today we celebrate...", H * 0.3,
    "italic 38px Georgia, serif", "#a8daff", "#74B9FF", 15, line1Alpha);

  // Name — scale + fade in with float
  const nameT = smoothstep((t - 0.2) * 3);
  const floatY = Math.sin(time * 1.5) * 10;
  const nameScale = lerp(0.3, 1, nameT);
  const nameAlpha = nameT;

  if (nameAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = nameAlpha;
    ctx.translate(W / 2, H / 2 + floatY);
    ctx.scale(nameScale, nameScale);
    ctx.translate(-W / 2, -(H / 2 + floatY));

    // Glow passes
    ctx.font = `bold 120px 'Dancing Script', Georgia, cursive`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#74B9FF";
    ctx.shadowBlur = 60;
    ctx.fillStyle = "#74B9FF";
    ctx.fillText(opts.name, W / 2, H / 2 + floatY);

    ctx.shadowBlur = 0;
    const nameGrad = linearGrad(ctx, W / 2 - 200, 0, W / 2 + 200, 0, [
      [0, "#a8daff"],
      [0.5, "#fff"],
      [1, "#a8daff"],
    ]);
    ctx.fillStyle = nameGrad;
    ctx.fillText(opts.name, W / 2, H / 2 + floatY);
    ctx.restore();
  }
}

/** Scene 4: Main birthday message — most visually impressive */
function renderScene4(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions
) {
  const { stars, particles, balloons, time } = state;

  // Deep celebration background
  ctx.fillStyle = linearGrad(ctx, 0, 0, W, H, [
    [0, "#0d0d2b"],
    [0.3, "#1a0040"],
    [0.7, "#2d0060"],
    [1, "#0d0d2b"],
  ]);
  ctx.fillRect(0, 0, W, H);

  // Animated pulsing glow rings
  for (let i = 0; i < 4; i++) {
    const ringT = ((time * 0.5 + i * 0.25) % 1);
    const ringR = ringT * 500;
    const ringAlpha = (1 - ringT) * 0.15;
    ctx.save();
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = "#A29BFE";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawStars(ctx, stars, time, 0.7);
  drawAllParticles(ctx, particles);
  balloons.forEach(b => drawBalloon(ctx, b, time, 0.5));

  // "Happy Birthday," — smaller line above
  const line1Alpha = smoothstep(t * 5);
  drawGlowText(ctx, "Happy Birthday,", H * 0.28,
    "bold 58px Georgia, serif", "#FFE66D", "#FFD700", 25, line1Alpha);

  // Giant name — the hero element
  const nameT = smoothstep((t - 0.15) * 4);
  const pulse = 1 + Math.sin(time * 3) * 0.03;
  if (nameT > 0) {
    ctx.save();
    ctx.globalAlpha = nameT;
    ctx.translate(W / 2, H / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-W / 2, -H / 2);

    ctx.font = `bold 110px 'Dancing Script', Georgia, cursive`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Multi-layer glow
    ["#FFD700", "#FF6B6B", "#A29BFE"].forEach((c, i) => {
      ctx.shadowColor = c;
      ctx.shadowBlur = 40 - i * 10;
      ctx.fillStyle = c + "44";
      ctx.fillText(opts.name + "! 🎉", W / 2, H / 2);
    });

    // Final crisp pass
    ctx.shadowBlur = 0;
    const heroGrad = linearGrad(ctx, W / 2 - 300, 0, W / 2 + 300, 0, [
      [0, "#FFD700"],
      [0.3, "#FF6B6B"],
      [0.6, "#FFE66D"],
      [1, "#FFD700"],
    ]);
    ctx.fillStyle = heroGrad;
    ctx.fillText(opts.name + "! 🎉", W / 2, H / 2);
    ctx.restore();
  }

  // Emoji row
  const emojiAlpha = smoothstep((t - 0.4) * 4);
  drawGlowText(ctx, "🎂 🎈 🥳 🎁 ✨ 🎊", H * 0.78,
    "52px Arial", "#fff", "#fff", 5, emojiAlpha);
}

/** Scene 5: Born date + age + personal message */
function renderScene5(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  opts: GeneratorOptions
) {
  const { stars, particles, time } = state;

  // Warm rosy background
  ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
    [0, "#1a0028"],
    [0.5, "#2a0040"],
    [1, "#1a0028"],
  ]);
  ctx.fillRect(0, 0, W, H);

  const warmGlow = radialGrad(ctx, W / 2, H * 0.4, 0, "rgba(253,121,168,0.2)", "transparent");
  ctx.fillStyle = warmGlow;
  ctx.fillRect(0, 0, W, H);

  drawStars(ctx, stars, time, 0.6);
  drawAllParticles(ctx, particles);

  // Card background
  const cardAlpha = smoothstep(t * 4);
  ctx.save();
  ctx.globalAlpha = cardAlpha * 0.15;
  ctx.fillStyle = "#fff";
  const cardW = 760, cardH = 340;
  const cardX = (W - cardW) / 2, cardY = (H - cardH) / 2;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 20);
  ctx.fill();
  ctx.globalAlpha = cardAlpha * 0.3;
  ctx.strokeStyle = "#FD79A8";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const t1 = smoothstep(t * 4);
  const t2 = smoothstep((t - 0.25) * 4);
  const t3 = smoothstep((t - 0.5) * 4);

  drawGlowText(ctx, `🎂 Born on ${opts.formattedDate}`, H / 2 - 80,
    "bold 40px Georgia, serif", "#FFE66D", "#FFD700", 15, t1);

  drawGlowText(ctx, `Turning ${opts.age} — What a Milestone! 🎉`, H / 2,
    "bold 44px Georgia, serif", "#fff", "#A29BFE", 20, t2);

  drawGlowText(ctx, "Wishing you happiness, success & beautiful moments! ❤️", H / 2 + 80,
    "italic 32px Georgia, serif", "#FD79A8", "#FD79A8", 10, t3);
}

/** Scene 6: Final celebration — confetti explosion + farewell text */
function renderScene6(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: SharedState,
  _opts: GeneratorOptions
) {
  const { stars, particles, balloons, time } = state;

  // Festive multi-color gradient
  ctx.fillStyle = linearGrad(ctx, 0, 0, W, H, [
    [0, "#0d0040"],
    [0.25, "#1a0060"],
    [0.5, "#000080"],
    [0.75, "#1a0060"],
    [1, "#0d0040"],
  ]);
  ctx.fillRect(0, 0, W, H);

  // Sparkle rings
  for (let i = 0; i < 6; i++) {
    const angle = (time * 0.3 + i / 6) * Math.PI * 2;
    const r = 200 + Math.sin(time + i) * 30;
    const sx = W / 2 + Math.cos(angle) * r;
    const sy = H / 2 + Math.sin(angle) * r * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 2 + i);
    ctx.fillStyle = CONFETTI_COLORS[i];
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawStars(ctx, stars, time, 0.8);
  drawAllParticles(ctx, particles);
  balloons.forEach(b => drawBalloon(ctx, b, time, 0.7));

  // Main text
  const t1 = smoothstep(t * 3);
  const t2 = smoothstep((t - 0.3) * 3);
  const t3 = smoothstep((t - 0.6) * 4);

  const pulse = 1 + Math.sin(time * 4) * 0.04;
  ctx.save();
  ctx.translate(W / 2, H / 2 - 60);
  ctx.scale(pulse, pulse);
  ctx.translate(-W / 2, -(H / 2 - 60));
  drawGlowText(ctx, "🎉 Have an Amazing Birthday! 🎉", H / 2 - 60,
    "bold 62px Georgia, serif", "#FFE66D", "#FF6B6B", 35, t1);
  ctx.restore();

  drawGlowText(ctx, "May all your dreams come true! 🌟", H / 2 + 30,
    "italic 38px Georgia, serif", "#a8daff", "#74B9FF", 15, t2);

  drawGlowText(ctx, "With Love ❤️", H / 2 + 110,
    "bold 36px Georgia, serif", "#FD79A8", "#FD79A8", 10, t3);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * generateBirthdayVideo
 * ----------------------
 * Renders a 6-scene birthday animation on an offscreen Canvas,
 * records it via MediaRecorder, and resolves with the resulting Blob.
 *
 * @param opts       - name, formatted date, age
 * @param onProgress - called with 0–100 as rendering progresses
 * @returns          - Promise<VideoResult> containing the Blob, extension, and mimeType
 */
export async function generateBirthdayVideo(
  opts: GeneratorOptions,
  onProgress: ProgressCallback
): Promise<VideoResult> {
  // 1. Check MediaRecorder support
  const mimeInfo = getSupportedMimeType();
  if (!mimeInfo) {
    throw new Error("Your browser does not support video recording. Please use Chrome or Firefox.");
  }
  // Destructure now so TypeScript knows these values are definitely strings
  // (mimeInfo narrowing can be lost inside async/Promise callbacks)
  const { mimeType: recordingMimeType, extension: recordingExtension } = mimeInfo;

  // 2. Create offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 3. Set up MediaRecorder
  // captureStream(30) requests 30 fps from the canvas
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: recordingMimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  // 4. Define scenes: [renderFn, durationSeconds]
  // Total duration: 3 + 4 + 3 + 5 + 3 + 4 = 22 seconds
  const FPS = 30;
  const scenes: Array<{
    fn: (ctx: CanvasRenderingContext2D, t: number, state: SharedState, opts: GeneratorOptions) => void;
    duration: number;
  }> = [
    { fn: renderScene1, duration: 3 },
    { fn: renderScene2, duration: 4 },
    { fn: renderScene3, duration: 3 },
    { fn: renderScene4, duration: 5 },
    { fn: renderScene5, duration: 3 },
    { fn: renderScene6, duration: 4 },
  ];
  const totalFrames = scenes.reduce((s, sc) => s + sc.duration * FPS, 0);

  // 5. Shared animation state — created once and mutated each frame
  const state: SharedState = {
    stars: createStars(120),
    particles: createParticles(80, true),
    balloons: createBalloons(8),
    time: 0,
  };

  // 6. Render all frames synchronously in a Promise
  return new Promise<VideoResult>((resolve, reject) => {
    recorder.start();

    let globalFrame = 0;
    let sceneIndex = 0;
    let sceneFrame = 0;

    function renderNextFrame() {
      try {
        if (sceneIndex >= scenes.length) {
          // All scenes done — stop recording
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: recordingMimeType });
            resolve({ blob, extension: recordingExtension, mimeType: recordingMimeType });
          };
          recorder.stop();
          return;
        }

        const scene = scenes[sceneIndex];
        const sceneTotalFrames = scene.duration * FPS;
        const t = sceneFrame / sceneTotalFrames; // 0 → 1 within this scene

        // Update shared animated state
        state.time = globalFrame / FPS;
        updateParticles(state.particles, 0.06);
        state.balloons.forEach(b => {
          b.x += b.vx;
          b.y += b.vy;
          if (b.y < -100) { b.y = H + 80; b.x = Math.random() * W; }
        });

        // Render current scene
        scene.fn(ctx, t, state, opts);

        sceneFrame++;
        globalFrame++;

        if (sceneFrame >= sceneTotalFrames) {
          sceneIndex++;
          sceneFrame = 0;
        }

        // Report progress
        onProgress(Math.round((globalFrame / totalFrames) * 100));

        // Yield to browser with requestAnimationFrame to keep recorder happy
        // Use setTimeout 0 for consistent 30fps pacing during recording
        setTimeout(renderNextFrame, 1000 / FPS);
      } catch (err) {
        recorder.stop();
        reject(err);
      }
    }

    renderNextFrame();
  });
}

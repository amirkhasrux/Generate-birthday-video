/**
 * lib/templates.ts
 * -----------------
 * Definitions for all available birthday video animation templates.
 * Each template has unique color schemes, particle styles, decoration aesthetics,
 * and typography glows.
 */

export type AnimationTemplateId = "cosmic" | "neon" | "golden" | "pastel";

export interface TemplateColors {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  bgDark: string;
  bgLight: string;
  confetti: string[];
}

export interface AnimationTemplate {
  id: AnimationTemplateId;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  accentColor: string;
  badge: string;
  previewGradient: string;
  colors: TemplateColors;
}

export const ANIMATION_TEMPLATES: AnimationTemplate[] = [
  {
    id: "cosmic",
    name: "Cosmic Starlight",
    tagline: "Celestial Galaxy & Nebula",
    description: "Deep space universe with glowing nebulae, stardust, twinkling stars, and ethereal purple-gold glows.",
    icon: "✨",
    accentColor: "#A29BFE",
    badge: "Popular",
    previewGradient: "linear-gradient(135deg, #0a0015 0%, #12003a 50%, #2d0060 100%)",
    colors: {
      primary: "#A29BFE",
      secondary: "#FFE66D",
      accent: "#74B9FF",
      glow: "#A29BFE",
      bgDark: "#07011a",
      bgLight: "#1a0040",
      confetti: [
        "#A29BFE", "#FFE66D", "#74B9FF", "#FD79A8",
        "#6C5CE7", "#00CEC9", "#FF7675", "#FFEAA7",
      ],
    },
  },
  {
    id: "neon",
    name: "Neon Cyber Glow",
    tagline: "Electric Synthwave & Retro",
    description: "High-energy cyberpunk vibes with glowing cyan and magenta light trails, laser grid, and neon sparkles.",
    icon: "⚡",
    accentColor: "#00F2FE",
    badge: "Vibrant",
    previewGradient: "linear-gradient(135deg, #050510 0%, #0d0029 50%, #00f2fe33 100%)",
    colors: {
      primary: "#00F2FE",
      secondary: "#FF007F",
      accent: "#FFE600",
      glow: "#00F2FE",
      bgDark: "#04020a",
      bgLight: "#180036",
      confetti: [
        "#00F2FE", "#FF007F", "#FFE600", "#7928CA",
        "#00FF88", "#FF0055", "#00E5FF", "#D946EF",
      ],
    },
  },
  {
    id: "golden",
    name: "Golden Luxury",
    tagline: "Regal Champagne & Obsidian",
    description: "Opulent obsidian and warm amber with floating champagne bokeh, glittering gold leaf, and royal elegance.",
    icon: "👑",
    accentColor: "#FFD700",
    badge: "Elegant",
    previewGradient: "linear-gradient(135deg, #0d0a05 0%, #2b1f0c 50%, #ffd70033 100%)",
    colors: {
      primary: "#FFD700",
      secondary: "#FFEAA7",
      accent: "#F39C12",
      glow: "#FFD700",
      bgDark: "#080603",
      bgLight: "#261a06",
      confetti: [
        "#FFD700", "#FFEAA7", "#F39C12", "#FFF9D2",
        "#D4AF37", "#C5A059", "#E6C280", "#FFFFFF",
      ],
    },
  },
  {
    id: "pastel",
    name: "Pastel Fiesta",
    tagline: "Sweet Candy & Carnival",
    description: "Joyful candy-colored celebration with soft pink, lavender, mint balloons, and sweet confetti shower.",
    icon: "🎈",
    accentColor: "#FD79A8",
    badge: "Playful",
    previewGradient: "linear-gradient(135deg, #1f0d25 0%, #3d1547 50%, #fd79a833 100%)",
    colors: {
      primary: "#FD79A8",
      secondary: "#4ECDC4",
      accent: "#FF9FF3",
      glow: "#FD79A8",
      bgDark: "#150820",
      bgLight: "#351445",
      confetti: [
        "#FD79A8", "#4ECDC4", "#FF9FF3", "#54A0FF",
        "#FECA57", "#1DD1A1", "#FF6B6B", "#C8D6E5",
      ],
    },
  },
];

export function getTemplateById(id: string): AnimationTemplate {
  const found = ANIMATION_TEMPLATES.find((t) => t.id === id);
  return found ?? ANIMATION_TEMPLATES[0];
}

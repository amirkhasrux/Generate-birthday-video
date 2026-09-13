"use client";
/**
 * components/TemplateSelector.tsx
 * ---------------------------------
 * Allows the user to select an animation theme template for their birthday video.
 * Displays interactive cards with theme gradients, badges, icons, and descriptions.
 */

import { ANIMATION_TEMPLATES, AnimationTemplateId } from "@/lib/templates";

interface TemplateSelectorProps {
  selectedId: AnimationTemplateId;
  onSelect: (id: AnimationTemplateId) => void;
  disabled?: boolean;
}

export default function TemplateSelector({
  selectedId,
  onSelect,
  disabled = false,
}: TemplateSelectorProps) {
  return (
    <div className="template-selector-container">
      <label className="form-label" id="template-selector-label">
        <span className="label-icon">🎨</span> Choose Animation Theme
      </label>

      <div
        className="template-grid"
        role="radiogroup"
        aria-labelledby="template-selector-label"
      >
        {ANIMATION_TEMPLATES.map((tmpl) => {
          const isSelected = tmpl.id === selectedId;
          return (
            <button
              key={tmpl.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`template-card ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(tmpl.id)}
              disabled={disabled}
              style={{
                borderColor: isSelected ? tmpl.accentColor : undefined,
                boxShadow: isSelected
                  ? `0 0 20px ${tmpl.accentColor}40, 0 8px 24px rgba(0,0,0,0.4)`
                  : undefined,
              }}
            >
              <div
                className="template-preview-bar"
                style={{ background: tmpl.previewGradient }}
              />

              <div className="template-card-content">
                <div className="template-card-header">
                  <span className="template-icon" role="img" aria-label={tmpl.name}>
                    {tmpl.icon}
                  </span>
                  <span
                    className="template-badge"
                    style={{
                      backgroundColor: `${tmpl.accentColor}22`,
                      color: tmpl.accentColor,
                      borderColor: `${tmpl.accentColor}44`,
                    }}
                  >
                    {tmpl.badge}
                  </span>
                </div>

                <h3 className="template-name">{tmpl.name}</h3>
                <p className="template-tagline">{tmpl.tagline}</p>
                <p className="template-desc">{tmpl.description}</p>

                <div className="template-palette-row">
                  {tmpl.colors.confetti.slice(0, 5).map((color, i) => (
                    <span
                      key={i}
                      className="palette-swatch"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {isSelected && (
                    <span className="template-check" style={{ color: tmpl.accentColor }}>
                      ✓ Selected
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

/**
 * components/LoadingScreen.tsx
 * -----------------------------
 * Displayed while the birthday video is being generated.
 * Shows an animated progress bar and rotating status messages.
 * Receives the current progress percentage (0–100) from the parent.
 */

interface LoadingScreenProps {
  progress: number;   // 0–100
  name: string;       // Person's name, shown in the loading message
}

// Status messages rotate as generation progresses
const STATUS_STEPS = [
  { threshold: 0,  icon: "✨", text: "Preparing your birthday animation..." },
  { threshold: 20, icon: "🎈", text: "Adding balloons and confetti..." },
  { threshold: 40, icon: "🌟", text: "Rendering a starfield just for you..." },
  { threshold: 55, icon: "🎂", text: "Baking the birthday cake..." },
  { threshold: 70, icon: "🎉", text: "Almost ready with the big surprise..." },
  { threshold: 88, icon: "💫", text: "Adding final sparkles..." },
  { threshold: 95, icon: "🎊", text: "Wrapping everything up..." },
];

export default function LoadingScreen({ progress, name }: LoadingScreenProps) {
  // Find which status step to show based on current progress
  let displayedStep = 0;
  STATUS_STEPS.forEach((s, i) => {
    if (progress >= s.threshold) displayedStep = i;
  });

  const current = STATUS_STEPS[displayedStep];

  return (
    <div className="loading-screen" aria-live="polite" aria-busy="true">
      {/* Animated cake/celebration icon */}
      <div className="loading-icon" aria-hidden="true">
        <span className="loading-emoji">🎂</span>
        <div className="loading-rings">
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring ring-3" />
        </div>
      </div>

      <h2 className="loading-title">
        Creating <span className="loading-name">{name}&apos;s</span> Birthday Video
      </h2>

      <p className="loading-status">
        <span className="status-icon">{current.icon}</span>
        {current.text}
      </p>

      {/* Progress bar */}
      <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
        <span className="progress-label">{progress}%</span>
      </div>

      {/* Step indicators */}
      <div className="step-dots" aria-hidden="true">
        {STATUS_STEPS.map((_, i) => (
          <div
            key={i}
            className={`step-dot ${i <= displayedStep ? "step-dot-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

/**
 * components/BirthdayVideo.tsx
 * -----------------------------
 * Displays the generated birthday video in an HTML <video> player with
 * template information, format details, and action buttons.
 */

import { useEffect, useRef } from "react";
import DownloadButton from "./DownloadButton";
import { AnimationTemplateId, getTemplateById } from "@/lib/templates";

interface BirthdayVideoProps {
  objectUrl: string;
  name: string;
  extension: string;
  mimeType: string;
  templateId?: AnimationTemplateId;
  onCreateAnother: () => void;
}

export default function BirthdayVideo({
  objectUrl,
  name,
  extension,
  mimeType,
  templateId = "cosmic",
  onCreateAnother,
}: BirthdayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const template = getTemplateById(templateId);

  // Auto-play once the video is ready
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().catch(() => {
        // Autoplay blocked by browser policy — user can press play manually
      });
    }
  }, [objectUrl]);

  return (
    <div className="video-result">
      <div className="video-result-header">
        <div className="theme-badge-pill" style={{ borderColor: template.accentColor }}>
          <span>{template.icon}</span> Theme: <strong>{template.name}</strong>
        </div>
        <h2 className="result-title">
          🎉 {name}&apos;s Birthday Video is Ready!
        </h2>
        <p className="result-subtitle">
          Watch the video below, then download it to share the birthday love! 💝
        </p>
      </div>

      {/* Video Player */}
      <div className="video-wrapper">
        <video
          ref={videoRef}
          id="birthday-video-player"
          className="birthday-video"
          controls
          loop
          playsInline
          aria-label={`Birthday video for ${name}`}
        >
          <source src={objectUrl} type={mimeType} />
          Your browser does not support the video element.
        </video>
      </div>

      <p className="video-format-note">
        📹 Format: {extension.toUpperCase()} · 1280×720 HD · ~20 seconds
      </p>

      {/* Action buttons */}
      <div className="video-actions">
        <DownloadButton objectUrl={objectUrl} name={name} extension={extension} />
        <button
          id="create-another-btn"
          className="btn btn-secondary"
          onClick={onCreateAnother}
        >
          🔄 Create Another Video
        </button>
      </div>
    </div>
  );
}

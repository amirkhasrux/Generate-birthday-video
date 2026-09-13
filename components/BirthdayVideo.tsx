"use client";

/**
 * components/BirthdayVideo.tsx
 * -----------------------------
 * Displays the generated birthday video in an HTML <video> player.
 *
 * Object URL lifecycle:
 *   - Created by the parent with URL.createObjectURL(blob)
 *   - Passed in as `objectUrl` prop
 *   - Parent is responsible for revoking the URL when it's no longer needed
 *     (on "Create Another Video" or component unmount)
 *
 * We do NOT revoke the URL inside this component — the parent orchestrates that
 * so the DownloadButton can still use it after the video player mounts.
 */

import { useEffect, useRef } from "react";
import DownloadButton from "./DownloadButton";

interface BirthdayVideoProps {
  objectUrl: string;
  name: string;
  extension: string;
  mimeType: string;
  onCreateAnother: () => void;   // Callback to reset everything
}

export default function BirthdayVideo({
  objectUrl,
  name,
  extension,
  mimeType,
  onCreateAnother,
}: BirthdayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

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
        📹 Format: {extension.toUpperCase()} · Duration: ~22 seconds · 1280×720
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

"use client";

/**
 * components/DownloadButton.tsx
 * ------------------------------
 * A button that triggers a video file download using the Object URL.
 *
 * Why create a temporary <a> element?
 *   The HTML5 download attribute only works on <a> elements.
 *   We programmatically create one, click it, and immediately remove it.
 *   This avoids needing a visible link in the DOM.
 */

import { sanitizeFilename } from "@/lib/birthday";

interface DownloadButtonProps {
  objectUrl: string;
  name: string;
  extension: string;   // "webm" — the actual recorded format
}

export default function DownloadButton({ objectUrl, name, extension }: DownloadButtonProps) {
  function handleDownload() {
    // Build a safe filename: "happy-birthday-munni.webm"
    const safeName = sanitizeFilename(name) || "friend";
    const filename = `happy-birthday-${safeName}.${extension}`;

    // Create a temporary hidden <a> element and click it
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // We do NOT revoke the URL here — the video player still needs it.
    // The parent component handles revoking at the right time.
  }

  return (
    <button
      id="download-video-btn"
      className="btn btn-download"
      onClick={handleDownload}
      title={`Download happy-birthday-${sanitizeFilename(name) || "friend"}.${extension}`}
    >
      ⬇️ Download Video
    </button>
  );
}

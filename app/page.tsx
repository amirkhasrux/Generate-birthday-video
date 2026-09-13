"use client";

/**
 * app/page.tsx
 * -------------
 * Top-level page component. Owns the application state machine:
 *
 *   "form" → "generating" → "generated"
 *                         ↘ "error"
 *                ↙ (Create Another Video)
 *
 * Also manages the Object URL lifecycle:
 *   - Created here after video generation
 *   - Revoked here when the user resets or the component unmounts
 *
 * Why in the page component and not a child?
 *   The URL must outlive both the LoadingScreen and BirthdayVideo components,
 *   and must be cleaned up in exactly one place. Having the page own it avoids
 *   double-revoke bugs and keeps the lifecycle explicit.
 */

import { useState, useEffect, useRef } from "react";
import BirthdayForm from "@/components/BirthdayForm";
import LoadingScreen from "@/components/LoadingScreen";
import BirthdayVideo from "@/components/BirthdayVideo";
import { generateBirthdayVideo } from "@/lib/videoGenerator";
import { calculateAge, formatDate, parseDob } from "@/lib/birthday";

// The four mutually-exclusive UI states
type AppState = "form" | "generating" | "generated" | "error";

interface VideoData {
  objectUrl: string;
  extension: string;
  mimeType: string;
  name: string;
}

// ─── Floating Particle Background (purely decorative) ─────────────────────────
function FloatingParticles() {
  const emojis = ["🎈", "⭐", "✨", "🎉", "🎊", "🌟", "💫", "🎁", "🎂", "🥳"];
  return (
    <div className="floating-particles" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="float-particle"
          style={{
            left: `${(i * 5.8) % 100}%`,
            animationDelay: `${(i * 0.7) % 6}s`,
            animationDuration: `${6 + (i % 5)}s`,
            fontSize: `${18 + (i % 3) * 8}px`,
          }}
        >
          {emojis[i % emojis.length]}
        </span>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [appState, setAppState] = useState<AppState>("form");
  const [progress, setProgress] = useState(0);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentName, setCurrentName] = useState("");

  // Ref to track the current Object URL so we can revoke it reliably
  // even if the component re-renders between creation and cleanup
  const objectUrlRef = useRef<string | null>(null);

  /**
   * Revokes the stored Object URL and clears the ref.
   * Must be called before creating a new URL or on unmount.
   */
  function revokeCurrentUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  // Revoke the URL when the page unmounts (e.g., navigation away)
  useEffect(() => {
    return () => { revokeCurrentUrl(); };
  }, []);

  /**
   * handleGenerate — called by BirthdayForm when the user submits valid data.
   * Triggers video generation and transitions through app states.
   */
  async function handleGenerate(name: string, dob: string) {
    // Clean up any existing video before starting a new one
    revokeCurrentUrl();
    setVideoData(null);
    setProgress(0);
    setCurrentName(name);
    setAppState("generating");
    setErrorMessage("");

    try {
      const dobDate = parseDob(dob);
      const age = calculateAge(dobDate);
      const formattedDate = formatDate(dobDate);

      const result = await generateBirthdayVideo(
        { name, formattedDate, age },
        (pct) => setProgress(pct)   // update progress bar in real time
      );

      // Create an Object URL from the Blob.
      // This URL exists only in memory — it disappears on page refresh.
      const objectUrl = URL.createObjectURL(result.blob);
      objectUrlRef.current = objectUrl;

      setVideoData({
        objectUrl,
        extension: result.extension,
        mimeType: result.mimeType,
        name,
      });
      setAppState("generated");
    } catch (err) {
      console.error("Video generation failed:", err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(message);
      setAppState("error");
    }
  }

  /**
   * handleCreateAnother — resets state so the user can generate a new video.
   * Crucially revokes the old Object URL to free browser memory.
   */
  function handleCreateAnother() {
    revokeCurrentUrl();
    setVideoData(null);
    setProgress(0);
    setCurrentName("");
    setErrorMessage("");
    setAppState("form");
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="app-main">
      <FloatingParticles />

      <div className="app-container">
        {/* ── Header (always visible) ──────────────────────────────────────── */}
        <header className="app-header">
          <div className="header-badge">🎂 Birthday Magic</div>
          <h1 className="app-title">
            Create a Special<br />
            <span className="title-highlight">Birthday Video</span>
          </h1>
          <p className="app-description">
            Enter a name and birth date to generate a personalized<br />
            birthday animation in seconds. 🎉
          </p>
        </header>

        {/* ── Main Content Area ────────────────────────────────────────────── */}
        <div className="content-card">
          {appState === "form" && (
            <BirthdayForm
              onSubmit={handleGenerate}
              isGenerating={false}
            />
          )}

          {appState === "generating" && (
            <LoadingScreen progress={progress} name={currentName} />
          )}

          {appState === "generated" && videoData && (
            <BirthdayVideo
              objectUrl={videoData.objectUrl}
              name={videoData.name}
              extension={videoData.extension}
              mimeType={videoData.mimeType}
              onCreateAnother={handleCreateAnother}
            />
          )}

          {appState === "error" && (
            <div className="error-screen" role="alert">
              <div className="error-icon">😕</div>
              <h2 className="error-title">Something went wrong</h2>
              <p className="error-detail">
                {errorMessage.includes("browser") || errorMessage.includes("support")
                  ? errorMessage
                  : "Something went wrong while creating your video. Please try again."}
              </p>
              <button
                id="try-again-btn"
                className="btn btn-primary"
                onClick={handleCreateAnother}
              >
                🔄 Try Again
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="app-footer">
          <p>✨ Videos exist only in your browser · No data is stored · Refresh to start fresh ✨</p>
          <h1>This Website Created By Amir Khasru</h1>
        </footer>
      </div>
    </main>
  );
}

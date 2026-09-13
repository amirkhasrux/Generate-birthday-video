"use client";

/**
 * components/BirthdayForm.tsx
 * ----------------------------
 * Handles user input: name + date of birth.
 * Performs client-side validation before calling onSubmit.
 * Does not know anything about video generation — it just collects data.
 */

import { useState } from "react";
import { validateName, validateDob } from "@/lib/birthday";

interface BirthdayFormProps {
  /** Called when the form is valid and user clicks submit */
  onSubmit: (name: string, dob: string) => void;
  /** When true, the submit button is disabled (video is generating) */
  isGenerating: boolean;
}

export default function BirthdayForm({ onSubmit, isGenerating }: BirthdayFormProps) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [nameError, setNameError] = useState("");
  const [dobError, setDobError] = useState("");

  // Calculate today's date in YYYY-MM-DD for the max attribute of the date input
  const today = new Date().toISOString().split("T")[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate both fields
    const nameResult = validateName(name);
    const dobResult = validateDob(dob);

    setNameError(nameResult.valid ? "" : nameResult.message);
    setDobError(dobResult.valid ? "" : dobResult.message);

    if (!nameResult.valid || !dobResult.valid) return;

    // Pass trimmed name and raw dob string to parent
    onSubmit(name.trim(), dob);
  }

  return (
    <form className="birthday-form" onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label htmlFor="name-input" className="form-label">
          <span className="label-icon">👤</span> Name
        </label>
        <input
          id="name-input"
          type="text"
          className={`form-input ${nameError ? "input-error" : ""}`}
          placeholder="Enter the birthday person's name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError("");
          }}
          maxLength={60}
          autoComplete="off"
          disabled={isGenerating}
        />
        {nameError && (
          <p className="error-message" role="alert">
            ⚠️ {nameError}
          </p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="dob-input" className="form-label">
          <span className="label-icon">🎂</span> Date of Birth
        </label>
        <input
          id="dob-input"
          type="date"
          className={`form-input ${dobError ? "input-error" : ""}`}
          value={dob}
          onChange={(e) => {
            setDob(e.target.value);
            if (dobError) setDobError("");
          }}
          max={today}
          min="1900-01-01"
          disabled={isGenerating}
        />
        {dobError && (
          <p className="error-message" role="alert">
            ⚠️ {dobError}
          </p>
        )}
      </div>

      <button
        id="create-video-btn"
        type="submit"
        className="btn btn-primary"
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Creating...
          </>
        ) : (
          <>🎬 Create Birthday Video</>
        )}
      </button>
    </form>
  );
}

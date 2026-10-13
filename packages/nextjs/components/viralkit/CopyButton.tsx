"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError("");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access is unavailable. Select the text and copy it manually.");
    }
  }
  return (
    <>
      <button className="button button-secondary" type="button" onClick={copy}>
        {copied ? "Copied" : label}
      </button>
      {error && (
        <span role="status" className="copy-error">
          {error}
        </span>
      )}
    </>
  );
}

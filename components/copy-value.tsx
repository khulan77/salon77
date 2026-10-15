"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
// A value with a button that copies it, for account numbers and references.
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy-value">
      <b>{value}</b>
      <button
        type="button"
        aria-label={`${label} хуулах`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value.replace(/\s/g, ""));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard can be blocked; the value stays visible to copy by hand.
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

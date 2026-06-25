"use client";

/**
 * Fable-style continuous progress bar.
 * `top` rendert hem fixed bovenaan de viewport (tijdens fetch/navigatie).
 */
export function ProgressBar({ top = false }: { top?: boolean }) {
  return <div className={`fable-bar${top ? " fable-bar--top" : ""}`} aria-hidden />;
}

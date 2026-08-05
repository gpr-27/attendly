"use client";

import Link from "next/link";

type EmptyGuideProps = {
  onAddSubject: () => void;
  onAddClass: () => void;
};

export function EmptyGuide({ onAddSubject, onAddClass }: EmptyGuideProps) {
  return (
    <div className="rise rise-delay-2 mt-6 rounded-[var(--radius)] border border-dashed border-line bg-surface-raised/70 px-4 py-6 sm:px-6">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
        Get started
      </p>
      <h2 className="font-display mt-1 text-xl font-semibold text-ink">
        Build your week in 3 steps
      </h2>
      <ol className="mt-4 space-y-3 text-sm text-ink-soft">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
            1
          </span>
          <div>
            <p className="font-semibold text-ink">Add a subject</p>
            <p className="text-mute">Name, short code, and a color chip.</p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
            2
          </span>
          <div>
            <p className="font-semibold text-ink">Add a weekly slot</p>
            <p className="text-mute">Pick day, start/end time, optional room.</p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-bold text-ink-soft">
            3
          </span>
          <div>
            <p className="font-semibold text-ink">Optional: import a photo</p>
            <p className="text-mute">
              Gemini can draft slots — you can still edit everything manually.
            </p>
          </div>
        </li>
      </ol>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onAddSubject}
          className="min-h-12 flex-1 rounded-full bg-brand text-sm font-semibold text-white"
        >
          Add subject
        </button>
        <button
          type="button"
          onClick={onAddClass}
          className="min-h-12 flex-1 rounded-full text-sm font-semibold text-ink ring-1 ring-line"
        >
          Add class
        </button>
        <Link
          href="/import"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full text-sm font-semibold text-mute ring-1 ring-line"
        >
          Import photo
        </Link>
      </div>
    </div>
  );
}

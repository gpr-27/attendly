"use client";

import { useState } from "react";
import { SUBJECT_PALETTE } from "@/lib/db";

type AddSubjectFormProps = {
  busy: boolean;
  defaultColor?: string;
  onSubmit: (input: {
    name: string;
    shortCode: string;
    color: string;
  }) => Promise<void>;
  onCancel?: () => void;
};

export function AddSubjectForm({
  busy,
  defaultColor = SUBJECT_PALETTE[0],
  onSubmit,
  onCancel,
}: AddSubjectFormProps) {
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [color, setColor] = useState(defaultColor);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-[var(--radius)] border border-line bg-surface-raised p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const code = shortCode.trim().toUpperCase();
        if (!trimmedName || !code) {
          setLocalError("Name and short code are required.");
          return;
        }
        setLocalError(null);
        void onSubmit({ name: trimmedName, shortCode: code, color });
      }}
    >
      <p className="text-sm font-semibold text-ink">Add subject</p>
      <label className="block text-xs font-medium text-mute">
        Name
        <input
          required
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Data Structures"
          autoFocus
        />
      </label>
      <label className="block text-xs font-medium text-mute">
        Short code
        <input
          required
          maxLength={8}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-ink"
          value={shortCode}
          onChange={(e) => setShortCode(e.target.value)}
          placeholder="e.g. DSA"
        />
      </label>
      <fieldset>
        <legend className="text-xs font-medium text-mute">Color</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUBJECT_PALETTE.map((c) => {
            const selected = c === color;
            return (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={selected}
                onClick={() => setColor(c)}
                className="h-9 w-9 rounded-full ring-offset-2 ring-offset-surface-raised transition"
                style={{
                  backgroundColor: c,
                  boxShadow: selected ? `0 0 0 2px ${c}` : undefined,
                  outline: selected ? "2px solid var(--ink)" : undefined,
                  outlineOffset: "2px",
                }}
              />
            );
          })}
        </div>
      </fieldset>
      {localError ? (
        <p className="text-sm text-risk-danger">{localError}</p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 flex-1 rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-60"
        >
          Save subject
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-full px-4 text-sm font-medium text-mute ring-1 ring-line"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

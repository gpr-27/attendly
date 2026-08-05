"use client";

import { cn } from "@/lib/cn";
import {
  EDIT_SCOPE_OPTIONS,
  type EditScopeValue,
} from "@/lib/timetable/scope-copy";

/** Canonical class-mutation scopes — exactly two product options. */
export type ClassMutationScope = EditScopeValue;

export const CLASS_MUTATION_SCOPES = EDIT_SCOPE_OPTIONS;

type MutationScopeRadiosProps = {
  value: ClassMutationScope;
  onChange: (scope: ClassMutationScope) => void;
  /** Fieldset legend. */
  legend?: string;
  name?: string;
  /** Soften / hide the permanent option (e.g. one-off extras). */
  allowPermanent?: boolean;
  className?: string;
};

/**
 * Exactly two clear scopes for move / edit / cancel / add class mutations.
 */
export function MutationScopeRadios({
  value,
  onChange,
  legend = "How far should this apply?",
  name = "mutation-scope",
  allowPermanent = true,
  className,
}: MutationScopeRadiosProps) {
  const options = allowPermanent
    ? CLASS_MUTATION_SCOPES
    : CLASS_MUTATION_SCOPES.filter((o) => o.value === "this_date");

  return (
    <fieldset
      className={cn(
        "space-y-2 rounded-xl border border-line bg-surface/80 p-3",
        className,
      )}
    >
      <legend className="px-1 text-xs font-semibold text-ink">{legend}</legend>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            "flex cursor-pointer gap-3 rounded-xl px-3 py-2.5 ring-1 transition",
            value === opt.value
              ? "bg-mist/80 ring-brand/40"
              : "bg-surface-raised ring-line",
          )}
        >
          <input
            type="radio"
            name={name}
            className="mt-1"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              {opt.label}
            </span>
            <span className="mt-0.5 block text-xs text-mute">{opt.hint}</span>
          </span>
        </label>
      ))}
      {!allowPermanent ? (
        <p className="pt-0.5 text-[0.7rem] text-mute">
          This class isn’t on the permanent weekly pattern — only this date
          applies.
        </p>
      ) : null}
    </fieldset>
  );
}

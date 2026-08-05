"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createGroupRequest, GroupApiError } from "@/lib/groups/client";
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_INSTITUTION_MAX,
  GROUP_NAME_MAX,
  validateGroupDescription,
  validateGroupName,
  validateInstitution,
} from "@/lib/groups/validation";

export function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const trimmedInstitution = institution.trim();

    const nameCheck = validateGroupName(trimmedName);
    if (!nameCheck.ok) return setError(nameCheck.error);
    const descCheck = validateGroupDescription(trimmedDesc);
    if (!descCheck.ok) return setError(descCheck.error);
    if (trimmedInstitution) {
      const instCheck = validateInstitution(trimmedInstitution);
      if (!instCheck.ok) return setError(instCheck.error);
    }

    setError(null);
    setBusy(true);
    try {
      const group = await createGroupRequest({
        name: trimmedName,
        description: trimmedDesc || undefined,
        institution: trimmedInstitution || undefined,
      });
      router.push(`/groups/${group.id}`);
    } catch (e2) {
      setError(
        e2 instanceof GroupApiError ? e2.message : "Could not create group. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="w-full max-w-xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <Link
        href="/groups"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-mute hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to groups
      </Link>

      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand">
        New group
      </p>
      <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Start a public group
      </h1>
      <p className="mt-1.5 max-w-md text-sm text-mute">
        Anyone signed in can find and join. You&rsquo;ll be the group admin.
      </p>

      <Card className="mt-6 p-5">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-xs font-medium text-mute">
            Group name
            <input
              required
              autoFocus
              maxLength={GROUP_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CSE 2027 — Section B"
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none ring-brand/30 focus:ring-2"
            />
          </label>

          <label className="block text-xs font-medium text-mute">
            Description <span className="text-mute/70">(optional)</span>
            <textarea
              rows={3}
              maxLength={GROUP_DESCRIPTION_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group for?"
              className="mt-1 w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none ring-brand/30 focus:ring-2"
            />
          </label>

          <label className="block text-xs font-medium text-mute">
            Institution <span className="text-mute/70">(optional)</span>
            <input
              maxLength={GROUP_INSTITUTION_MAX}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. NIT Trichy"
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none ring-brand/30 focus:ring-2"
            />
          </label>

          {error ? (
            <p className="rounded-xl bg-risk-danger-bg px-3 py-2 text-sm text-risk-danger">
              {error}
            </p>
          ) : null}

          <p className="text-xs leading-relaxed text-mute">
            Groups are public and searchable by every signed-in Attendly user.
            Chat only — personal attendance marks are never shared here.
          </p>

          <Button type="submit" large disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create group"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

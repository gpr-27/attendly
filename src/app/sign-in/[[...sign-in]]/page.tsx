import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { attendlyClerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col px-4 pb-10 pt-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-ink"
        >
          Attendly
        </Link>
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-8">
        <SignIn
          appearance={attendlyClerkAppearance}
          forceRedirectUrl="/"
          fallbackRedirectUrl="/"
          signUpUrl="/sign-up"
        />
        <p className="mt-6 max-w-xs text-center text-xs leading-relaxed text-mute">
          Attendance is stored on this device for now.
        </p>
      </div>
    </main>
  );
}

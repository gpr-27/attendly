import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { attendlyClerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 pt-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl"
        >
          Attendly
        </Link>
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8 lg:px-10">
        <div className="w-full max-w-[26rem] sm:max-w-[28rem]">
          <SignUp
            appearance={attendlyClerkAppearance}
            forceRedirectUrl="/"
            fallbackRedirectUrl="/"
            signInUrl="/sign-in"
          />
        </div>
        <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-mute">
          Attendance is stored on this device for now.
        </p>
      </div>
    </main>
  );
}

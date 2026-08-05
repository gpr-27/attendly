import { cn } from "@/lib/utils/cn";

type PageShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Wider content for data-heavy pages (calendar, subjects grid). */
  wide?: boolean;
};

/** Consistent page chrome — padding, header rhythm, max width inside the app frame. */
export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  wide,
}: PageShellProps) {
  return (
    <main
      className={cn(
        "w-full px-4 pb-10 pt-6 sm:px-6 lg:px-8",
        wide ? "max-w-6xl" : "max-w-5xl",
        className,
      )}
    >
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-xl text-sm text-mute">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex min-w-0 shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}

import { cn } from "@/lib/utils/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
};

/** Surface for interactive or dense content — not decorative chrome. */
export function Card({ children, className, as: Tag = "div" }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

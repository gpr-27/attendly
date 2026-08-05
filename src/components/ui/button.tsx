import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-deep disabled:opacity-50",
  secondary:
    "border border-line bg-surface-raised text-ink hover:bg-mist/70 disabled:opacity-50",
  ghost: "text-ink-soft hover:bg-mist/60 hover:text-ink disabled:opacity-50",
  danger:
    "bg-risk-danger text-white hover:brightness-105 disabled:opacity-50",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Prefer for thumb-zone actions (~44px). */
  large?: boolean;
};

export function Button({
  variant = "primary",
  large,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition",
        large ? "min-h-11 px-4 py-2.5" : "min-h-10 px-3.5 py-2",
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}

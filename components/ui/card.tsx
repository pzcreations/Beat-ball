import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-lg border border-line bg-white shadow-xs", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 md:px-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-navy-900">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: "neutral" | "navy" | "azure" | "success" | "danger" | "warning" }) {
  const tones = {
    neutral: "bg-surface text-muted border-line",
    navy: "bg-navy-900 text-white border-navy-900",
    azure: "bg-azure-100 text-navy-800 border-azure-200",
    success: "bg-success-bg text-success border-[#cfe9da]",
    danger: "bg-danger-bg text-danger border-[#f6d3cf]",
    warning: "bg-warning-bg text-warning border-[#f2e0b8]",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-4",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-5 animate-enter md:mb-7">
      {back ? <div className="mb-2">{back}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-navy-900 md:text-2xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-azure-50 text-navy-700 [&_svg]:size-5">
        {icon}
      </div>
      <p className="font-medium text-navy-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "danger",
  children,
  className,
}: {
  tone?: "danger" | "success" | "warning" | "info";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    danger: "border-[#f6d3cf] bg-danger-bg text-danger",
    success: "border-[#cfe9da] bg-success-bg text-success",
    warning: "border-[#f2e0b8] bg-warning-bg text-warning",
    info: "border-azure-200 bg-azure-50 text-navy-800",
  } as const;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-3.5 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "h-12 w-full rounded-md border border-line bg-white px-3.5 text-ink shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-subtle hover:border-azure-300 focus:border-navy-700 focus:ring-3 focus:ring-azure-100 disabled:bg-surface disabled:text-muted aria-invalid:border-danger aria-invalid:focus:ring-danger-bg md:h-11";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        inputClass,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235b6878%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-navy-900", className)} {...props} />;
}

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Agrupa rótulo, campo, dica e mensagem de erro com ARIA correto. */
export function Field({ id, label, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-erro`} role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-dica`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Atributos ARIA padronizados para um campo com possível erro. */
export function ariaFor(id: string, error?: string, hasHint = false) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-erro` : hasHint ? `${id}-dica` : undefined,
  } as const;
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn("size-5 shrink-0 rounded border-line accent-navy-900", className)}
      {...props}
    />
  );
}

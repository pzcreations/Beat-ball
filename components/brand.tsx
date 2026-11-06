import { cn } from "@/lib/utils";

/** Símbolo da marca: monograma "R" sobre azul-escuro com traço azul-claro. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="64" height="64" rx="15" fill="#0b2545" />
      <path
        d="M22 46V18h12.2c6.3 0 10.3 3.4 10.3 8.9 0 4.1-2.3 7-6 8.2L45 46h-6.6l-6-10.3H27.8V46H22Zm5.8-15.2h6c3 0 4.8-1.5 4.8-4s-1.8-3.9-4.8-3.9h-6v7.9Z"
        fill="#fff"
      />
      <rect x="22" y="50" width="23" height="3" rx="1.5" fill="#a8c8ec" />
    </svg>
  );
}

export function BrandLockup({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight text-navy-900">Recepção</p>
        {subtitle ? <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-subtle">{subtitle}</p> : null}
      </div>
    </div>
  );
}

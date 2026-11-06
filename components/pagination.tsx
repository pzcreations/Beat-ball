import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  basePath: string;
  params: Record<string, string | number | undefined>;
  page: number;
  pageSize: number;
  total: number;
};

export function buildHref(basePath: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export function Pagination({ basePath, params, page, pageSize, total }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const linkClass = (disabled: boolean) =>
    cn(
      "inline-flex h-10 items-center gap-1 rounded-md border border-line bg-white px-3 text-sm font-medium text-navy-900 transition-colors hover:bg-azure-50",
      disabled && "pointer-events-none opacity-45",
    );

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 md:px-5">
      <p className="text-sm text-muted tabular">
        {formatInt(from)}–{formatInt(to)} de {formatInt(total)}
      </p>
      <div className="flex gap-2">
        <Link
          href={buildHref(basePath, { ...params, pagina: page - 1 > 1 ? page - 1 : undefined })}
          className={linkClass(page <= 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
        >
          <ChevronLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Anterior</span>
        </Link>
        <Link
          href={buildHref(basePath, { ...params, pagina: page + 1 })}
          className={linkClass(page >= pages)}
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
        >
          <span className="hidden sm:inline">Próxima</span> <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}

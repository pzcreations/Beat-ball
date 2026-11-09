import { Clock3 } from "lucide-react";

import { ETAPA_COR } from "@/lib/atendimento";
import type { EtapaCor } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export function EtapaBadge({
  nome,
  cor,
  atrasado,
  className,
}: {
  nome: string;
  cor: EtapaCor;
  atrasado?: boolean;
  className?: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
          ETAPA_COR[cor].badge,
          className,
        )}
      >
        <span className={cn("size-1.5 rounded-full", ETAPA_COR[cor].dot)} aria-hidden />
        {nome}
      </span>
      {atrasado ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#f6d3cf] bg-danger-bg px-2 py-0.5 text-xs font-medium leading-4 text-danger">
          <Clock3 className="size-3" aria-hidden /> Atrasado
        </span>
      ) : null}
    </span>
  );
}

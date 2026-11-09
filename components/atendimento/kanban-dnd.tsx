"use client";

import { useState, useTransition, type ReactNode } from "react";

import { moverEtapaAction } from "@/app/actions/atendimento";
import { notify } from "@/components/ui/toaster";
import { cn, initialActionState } from "@/lib/utils";

const MIME = "application/x-recepcao-pessoa";

/** Cartão arrastável (somente desktop; no celular usam-se os botões). */
export function DraggableCard({
  pessoaId,
  etapaId,
  children,
}: {
  pessoaId: string;
  etapaId: number;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(MIME, JSON.stringify({ pessoaId, etapaId }));
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn("cursor-grab active:cursor-grabbing", dragging && "opacity-50")}
    >
      {children}
    </div>
  );
}

/**
 * Coluna que recebe cartões. A mudança é enviada à mesma ação do botão
 * "Mudar etapa" — e o banco valida se a transição é permitida.
 */
export function DropColumn({
  etapaId,
  encerrada,
  children,
  className,
}: {
  etapaId: number;
  encerrada?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const raw = e.dataTransfer.getData(MIME);
        if (!raw) return;
        let data: { pessoaId: string; etapaId: number };
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }
        if (data.etapaId === etapaId) return;
        if (encerrada) {
          notify("Para encerrar, use o botão “Mudar etapa” e informe o motivo.", "error");
          return;
        }
        const fd = new FormData();
        fd.set("pessoaId", data.pessoaId);
        fd.set("etapaId", String(etapaId));
        startTransition(async () => {
          const res = await moverEtapaAction(initialActionState, fd);
          notify(
            res.message ?? (res.status === "success" ? "Etapa atualizada." : "Não foi possível mover."),
            res.status === "success" ? "success" : "error",
          );
        });
      }}
      aria-busy={pending || undefined}
      className={cn(
        "transition-[background-color,box-shadow]",
        over && "bg-azure-50 ring-2 ring-azure-300 ring-inset",
        pending && "opacity-70",
        className,
      )}
    >
      {children}
    </div>
  );
}

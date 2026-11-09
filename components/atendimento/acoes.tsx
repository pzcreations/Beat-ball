"use client";

import { ArrowRightLeft, MessageCircle, PhoneCall, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { moverEtapaAction, registrarContatoAction } from "@/app/actions/atendimento";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Portal } from "@/components/ui/portal";
import { notify } from "@/components/ui/toaster";
import { ETAPA_COR, MOTIVO_LABEL, RESULTADO_LABEL, type EtapaInfo } from "@/lib/atendimento";
import { cn, initialActionState, type ActionState } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Estrutura comum: <dialog> nativo (folha inferior no celular).               */
/* -------------------------------------------------------------------------- */
export function useDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  return { ref, open: () => ref.current?.showModal(), close: () => ref.current?.close() };
}

export function Sheet({
  dialogRef,
  title,
  subtitle,
  onClose,
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Portal>
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="mx-auto mb-0 mt-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-white p-0 text-ink shadow-pop open:animate-toast sm:m-auto sm:rounded-xl"
    >
      <div className="pb-safe">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-navy-900">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-azure-50"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
    </Portal>
  );
}

export function OptionCard({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3.5 py-3 text-sm transition-colors",
        checked ? "border-navy-700 bg-azure-50 text-navy-900" : "border-line bg-white hover:border-azure-300",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="size-4 accent-navy-900"
        required
      />
      <span className="flex-1">{children}</span>
    </label>
  );
}

export type TriggerProps = { variant?: "primary" | "outline" | "secondary"; size?: "sm" | "md"; block?: boolean; compact?: boolean };

/* -------------------------------------------------------------------------- */
/* Registrar contato                                                          */
/* -------------------------------------------------------------------------- */
export function RegistrarContato({
  pessoaId,
  pessoaNome,
  variant = "outline",
  size = "md",
  block,
  compact,
}: { pessoaId: string; pessoaNome: string } & TriggerProps) {
  const { ref, open, close } = useDialog();
  const uid = useId();
  const [state, action] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await registrarContatoAction(prev, fd);
    // Aviso global: o cartão pode sair da lista ao mudar de etapa.
    if (res.status === "success" && res.message) notify(res.message);
    return res;
  }, initialActionState);
  const [resultado, setResultado] = useState("");

  useEffect(() => {
    if (state.status === "success") ref.current?.close();
  }, [state, ref]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        block={block}
        className={compact ? (size === "sm" ? "w-9 px-0" : "w-11 px-0") : undefined}
        onClick={() => {
          setResultado("");
          open();
        }}
        aria-label={compact ? "Registrar contato" : undefined}
      >
        <PhoneCall aria-hidden />
        {compact ? null : "Registrar contato"}
      </Button>
      <Sheet dialogRef={ref} title="Registrar contato" subtitle={pessoaNome} onClose={close}>
        <form action={action} className="grid gap-5 px-5 py-5" key={state.status === "success" ? state.at : "f"}>
          <input type="hidden" name="pessoaId" value={pessoaId} />
          {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium text-navy-900">Como foi o contato?</legend>
            {(Object.keys(RESULTADO_LABEL) as (keyof typeof RESULTADO_LABEL)[]).map((r) => (
              <OptionCard key={r} name="resultado" value={r} checked={resultado === r} onChange={setResultado}>
                {RESULTADO_LABEL[r]}
              </OptionCard>
            ))}
          </fieldset>

          <div className="grid gap-1.5">
            <Label htmlFor={`canal-${uid}`}>Canal</Label>
            <Select id={`canal-${uid}`} name="canal" defaultValue="whatsapp">
              <option value="whatsapp">WhatsApp</option>
              <option value="ligacao">Ligação</option>
              <option value="presencial">Pessoalmente</option>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`obs-c-${uid}`}>Observação (opcional)</Label>
            <Textarea id={`obs-c-${uid}`} name="observacao" maxLength={500} placeholder="Ex.: prefere visita no sábado à tarde" />
          </div>

          <SubmitButton size="lg" block pendingLabel="Salvando…" disabled={!resultado}>
            Salvar contato
          </SubmitButton>
        </form>
      </Sheet>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Mudar etapa                                                                */
/* -------------------------------------------------------------------------- */
export function MudarEtapa({
  pessoaId,
  pessoaNome,
  destinos,
  atualTipo,
  variant = "outline",
  size = "md",
  block,
  compact,
  preselecionado,
  triggerLabel = "Mudar etapa",
}: {
  pessoaId: string;
  pessoaNome: string;
  destinos: EtapaInfo[];
  atualTipo: EtapaInfo["tipo"];
  preselecionado?: number;
  triggerLabel?: string;
} & TriggerProps) {
  const { ref, open, close } = useDialog();
  const uid = useId();
  const [state, action] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await moverEtapaAction(prev, fd);
    if (res.status === "success" && res.message) notify(res.message);
    return res;
  }, initialActionState);
  const [destino, setDestino] = useState("");
  const escolhida = destinos.find((d) => String(d.id) === destino);

  useEffect(() => {
    if (state.status === "success") ref.current?.close();
  }, [state, ref]);

  if (destinos.length === 0) return null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        block={block}
        className={compact ? (size === "sm" ? "w-9 px-0" : "w-11 px-0") : undefined}
        onClick={() => {
          setDestino(preselecionado ? String(preselecionado) : "");
          open();
        }}
        aria-label={compact ? triggerLabel : undefined}
      >
        <ArrowRightLeft aria-hidden />
        {compact ? null : triggerLabel}
      </Button>
      <Sheet dialogRef={ref} title="Mudar etapa" subtitle={pessoaNome} onClose={close}>
        <form action={action} className="grid gap-5 px-5 py-5" key={state.status === "success" ? state.at : "f"}>
          <input type="hidden" name="pessoaId" value={pessoaId} />
          {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium text-navy-900">Mover para</legend>
            {destinos.map((d) => (
              <OptionCard key={d.id} name="etapaId" value={String(d.id)} checked={destino === String(d.id)} onChange={setDestino}>
                <span className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", ETAPA_COR[d.cor].dot)} aria-hidden />
                  {d.tipo === "inicial" && (atualTipo === "concluida" || atualTipo === "encerrada")
                    ? `Reabrir atendimento (${d.nome})`
                    : d.nome}
                </span>
              </OptionCard>
            ))}
          </fieldset>

          {escolhida?.tipo === "encerrada" ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`motivo-${uid}`}>Motivo do encerramento</Label>
              <Select id={`motivo-${uid}`} name="motivo" required defaultValue="">
                <option value="" disabled>
                  Selecione o motivo
                </option>
                {(Object.keys(MOTIVO_LABEL) as (keyof typeof MOTIVO_LABEL)[]).map((m) => (
                  <option key={m} value={m}>
                    {MOTIVO_LABEL[m]}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor={`obs-m-${uid}`}>Observação (opcional)</Label>
            <Textarea id={`obs-m-${uid}`} name="observacao" maxLength={500} placeholder="Ex.: visita combinada para sábado, 15h" />
          </div>

          <SubmitButton size="lg" block pendingLabel="Salvando…" disabled={!destino}>
            Confirmar
          </SubmitButton>
        </form>
      </Sheet>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* WhatsApp                                                                   */
/* -------------------------------------------------------------------------- */
export function WhatsAppLink({
  href,
  compact,
  block,
  size = "md",
}: {
  href: string;
  compact?: boolean;
  block?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={compact ? "Chamar no WhatsApp" : undefined}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#1f7a4d] font-medium text-white shadow-xs transition-colors hover:bg-[#19663f] active:scale-[0.985] [&_svg]:size-[18px]",
        size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-[15px]",
        compact && (size === "sm" ? "w-9 px-0" : "w-11 px-0"),
        block && "w-full",
      )}
    >
      <MessageCircle aria-hidden />
      {compact ? null : "Chamar no WhatsApp"}
    </a>
  );
}

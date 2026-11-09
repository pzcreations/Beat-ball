"use client";

import { CalendarCheck, CalendarClock, CalendarPlus } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";

import { agendarVisitaAction, reagendarVisitaAction, registrarVisitaAction } from "@/app/actions/visitas";
import { OptionCard, Sheet, useDialog, type TriggerProps } from "@/components/atendimento/acoes";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { notify } from "@/components/ui/toaster";
import { formatVisita, partesLocais } from "@/lib/format";
import { initialActionState, type ActionState } from "@/lib/utils";

type Gestor = { id: string; full_name: string };

type VisitaPendente = {
  id: string;
  agendada_para: string;
  endereco: string;
  visitante_id: string;
  observacao: string | null;
};

function useAcaoComAviso(acao: (s: ActionState, fd: FormData) => Promise<ActionState>) {
  return useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await acao(prev, fd);
    // Aviso global: o cartão pode mudar de etapa e sair da lista.
    if (res.status === "success" && res.message) notify(res.message);
    return res;
  }, initialActionState);
}

/* -------------------------------------------------------------------------- */
/* Agendar / reagendar                                                        */
/* -------------------------------------------------------------------------- */
export function AgendarVisita({
  pessoaId,
  pessoaNome,
  visita,
  gestores,
  visitantePadrao,
  enderecoSugerido,
  triggerLabel,
  variant = "primary",
  size = "md",
  block,
  compact,
}: {
  pessoaId: string;
  pessoaNome: string;
  /** Se informada, o diálogo reagenda esta visita. */
  visita?: VisitaPendente | null;
  gestores: Gestor[];
  visitantePadrao: string;
  enderecoSugerido?: string | null;
  triggerLabel?: string;
} & TriggerProps) {
  const reagendar = Boolean(visita);
  const { ref, open, close } = useDialog();
  const uid = useId();
  const [state, action] = useAcaoComAviso(reagendar ? reagendarVisitaAction : agendarVisitaAction);
  const [valores, setValores] = useState({ data: "", hora: "", minData: "" });

  useEffect(() => {
    if (state.status === "success") ref.current?.close();
  }, [state, ref]);

  const label = triggerLabel ?? (reagendar ? "Reagendar" : "Agendar visita");
  const Icon = reagendar ? CalendarClock : CalendarPlus;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        block={block}
        className={compact ? (size === "sm" ? "w-9 px-0" : "w-11 px-0") : undefined}
        aria-label={compact ? label : undefined}
        onClick={() => {
          const hoje = partesLocais(new Date().toISOString()).data;
          if (visita) {
            const p = partesLocais(visita.agendada_para);
            setValores({ data: p.data, hora: p.hora, minData: hoje < p.data ? hoje : p.data });
          } else {
            const amanha = partesLocais(new Date(Date.now() + 86_400_000).toISOString()).data;
            setValores({ data: amanha, hora: "", minData: hoje });
          }
          open();
        }}
      >
        <Icon aria-hidden />
        {compact ? null : label}
      </Button>
      <Sheet dialogRef={ref} title={reagendar ? "Reagendar visita" : "Agendar visita"} subtitle={pessoaNome} onClose={close}>
        <form action={action} className="grid gap-4 px-5 py-5" key={`${state.status === "success" ? state.at : "f"}-${valores.data}`}>
          {visita ? <input type="hidden" name="visitaId" value={visita.id} /> : <input type="hidden" name="pessoaId" value={pessoaId} />}
          {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}

          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`data-${uid}`}>Data</Label>
              <Input id={`data-${uid}`} name="data" type="date" required defaultValue={valores.data} min={valores.minData} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`hora-${uid}`}>Horário</Label>
              <Input id={`hora-${uid}`} name="hora" type="time" required defaultValue={valores.hora} step={300} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`end-${uid}`}>Endereço da visita</Label>
            <Textarea
              id={`end-${uid}`}
              name="endereco"
              required
              minLength={5}
              maxLength={300}
              rows={2}
              className="min-h-[72px]"
              placeholder="Rua, número, bairro e ponto de referência"
              defaultValue={visita?.endereco ?? enderecoSugerido ?? ""}
              autoComplete="street-address"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`vis-${uid}`}>Quem fará a visita</Label>
            <Select id={`vis-${uid}`} name="visitanteId" required defaultValue={visita?.visitante_id ?? visitantePadrao}>
              {gestores.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.full_name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`obs-${uid}`}>Observação (opcional)</Label>
            <Textarea
              id={`obs-${uid}`}
              name="observacao"
              maxLength={500}
              rows={2}
              className="min-h-[72px]"
              placeholder="Ex.: casa de esquina, portão azul"
              defaultValue={visita?.observacao ?? ""}
            />
          </div>

          <SubmitButton size="lg" block pendingLabel="Salvando…">
            {reagendar ? "Salvar novo horário" : "Agendar visita"}
          </SubmitButton>
        </form>
      </Sheet>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Registrar resultado                                                        */
/* -------------------------------------------------------------------------- */
const OPCOES = [
  { value: "realizada", label: "Visita realizada" },
  { value: "faltou", label: "Pessoa não estava / não pôde receber" },
  { value: "cancelada", label: "Visita cancelada" },
] as const;

export function RegistrarVisita({
  visitaId,
  pessoaNome,
  agendadaPara,
  label = "Registrar visita",
  variant = "outline",
  size = "md",
  block,
  compact,
}: {
  visitaId: string;
  pessoaNome: string;
  agendadaPara: string;
  label?: string;
} & TriggerProps) {
  const { ref, open, close } = useDialog();
  const uid = useId();
  const [state, action] = useAcaoComAviso(registrarVisitaAction);
  const [situacao, setSituacao] = useState("");

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
        aria-label={compact ? "Registrar visita" : undefined}
        onClick={() => {
          setSituacao("");
          open();
        }}
      >
        <CalendarCheck aria-hidden />
        {compact ? null : label}
      </Button>
      <Sheet dialogRef={ref} title="Como foi a visita?" subtitle={`${pessoaNome} · ${formatVisita(agendadaPara)}`} onClose={close}>
        <form action={action} className="grid gap-5 px-5 py-5" key={state.status === "success" ? state.at : "f"}>
          <input type="hidden" name="visitaId" value={visitaId} />
          {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
          <fieldset className="grid gap-2">
            <legend className="sr-only">Resultado</legend>
            {OPCOES.map((o) => (
              <OptionCard key={o.value} name="situacao" value={o.value} checked={situacao === o.value} onChange={setSituacao}>
                {o.label}
              </OptionCard>
            ))}
          </fieldset>
          {situacao && situacao !== "realizada" ? (
            <p className="-mt-2 text-[13px] text-muted">A pessoa volta para o agendamento, para combinar uma nova data.</p>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor={`res-${uid}`}>Observação (opcional)</Label>
            <Textarea id={`res-${uid}`} name="observacao" maxLength={500} placeholder="Ex.: oramos com a família; pediram retorno no mês que vem" />
          </div>
          <SubmitButton size="lg" block pendingLabel="Salvando…" disabled={!situacao}>
            Salvar
          </SubmitButton>
        </form>
      </Sheet>
    </>
  );
}

"use client";

import { KeyRound, Save, UserPlus } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, ariaFor } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import type { AppRole } from "@/lib/database.types";
import type { ActionState } from "@/lib/utils";

import { atualizarUsuarioAction, criarUsuarioAction, redefinirSenhaAction } from "./actions";

const SENHA_HINT = "Mínimo de 10 caracteres, com letras e números.";

function PermissionToggle({
  name,
  label,
  description,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`flex gap-3 rounded-md border border-line p-3.5 ${disabled ? "opacity-60" : "cursor-pointer hover:bg-azure-50/60"}`}>
      <Checkbox name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium text-navy-900">{label}</span>
        <span className="block text-[13px] text-muted">{description}</span>
      </span>
    </label>
  );
}

export function NovoUsuarioForm() {
  const [state, formAction] = useActionState(criarUsuarioAction, { status: "idle" } as ActionState<{
    fullName: string;
    email: string;
    senha: string;
    role: string;
  }>);
  const [role, setRole] = useState<AppRole>("recepcao");
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
      <Field id="fullName" label="Nome completo" error={e.fullName}>
        <Input {...ariaFor("fullName", e.fullName)} name="fullName" required maxLength={120} autoComplete="off" defaultValue={state.values?.fullName} />
      </Field>
      <Field id="email" label="E-mail de acesso" error={e.email}>
        <Input
          {...ariaFor("email", e.email)}
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          required
          defaultValue={state.values?.email}
        />
      </Field>
      <Field id="senha" label="Senha inicial" error={e.senha} hint={SENHA_HINT}>
        <Input {...ariaFor("senha", e.senha, true)} name="senha" type="password" autoComplete="new-password" required minLength={10} maxLength={72} />
      </Field>
      <Field id="role" label="Perfil de acesso" error={e.role}>
        <Select id="role" name="role" value={role} onChange={(ev) => setRole(ev.target.value as AppRole)}>
          <option value="recepcao">Recepção — cadastra pessoas</option>
          <option value="gestor">Gestor — acesso administrativo completo</option>
        </Select>
      </Field>
      {role === "recepcao" ? (
        <PermissionToggle
          name="canViewRecords"
          label="Permitir consulta de todos os cadastros"
          description="Sem esta permissão, o usuário consulta apenas os cadastros que ele mesmo fez."
        />
      ) : null}
      <SubmitButton size="lg" block pendingLabel="Criando…">
        <UserPlus aria-hidden /> Criar usuário
      </SubmitButton>
    </form>
  );
}

type EditProps = {
  user: { id: string; full_name: string; role: AppRole; can_view_records: boolean; active: boolean };
  isSelf: boolean;
};

export function EditarUsuarioForm({ user, isSelf }: EditProps) {
  const [state, formAction] = useActionState(atualizarUsuarioAction, { status: "idle" } as ActionState<{ fullName: string }>);
  const [role, setRole] = useState<AppRole>(user.role);
  const e = state.errors ?? {};

  return (
    <>
      <form action={formAction} className="grid gap-5" noValidate>
        <input type="hidden" name="id" value={user.id} />
        {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
        <Field id="fullName" label="Nome completo" error={e.fullName}>
          <Input
            {...ariaFor("fullName", e.fullName)}
            name="fullName"
            required
            maxLength={120}
            defaultValue={state.values?.fullName ?? user.full_name}
          />
        </Field>
        <Field id="role" label="Perfil de acesso">
          <Select id="role" name="role" value={role} onChange={(ev) => setRole(ev.target.value as AppRole)} disabled={isSelf}>
            <option value="recepcao">Recepção</option>
            <option value="gestor">Gestor</option>
          </Select>
        </Field>
        {/* Campos desabilitados não são enviados; mantém o valor atual. */}
        {isSelf ? <input type="hidden" name="role" value={user.role} /> : null}
        {role === "recepcao" ? (
          <PermissionToggle
            name="canViewRecords"
            label="Permitir consulta de todos os cadastros"
            description="Sem esta permissão, consulta apenas os próprios cadastros."
            defaultChecked={user.can_view_records}
          />
        ) : null}
        <PermissionToggle
          name="active"
          label="Acesso ativo"
          description="Desative para bloquear imediatamente o acesso deste usuário ao sistema."
          defaultChecked={user.active}
          disabled={isSelf}
        />
        {isSelf ? <input type="hidden" name="active" value="on" /> : null}
        <SubmitButton size="lg" block pendingLabel="Salvando…">
          <Save aria-hidden /> Salvar alterações
        </SubmitButton>
      </form>
      <Toast message={state.status === "success" ? state.message : undefined} stamp={state.at} />
    </>
  );
}

export function RedefinirSenhaForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(redefinirSenhaAction, { status: "idle" } as ActionState<{ senha: string }>);
  const e = state.errors ?? {};
  return (
    <form action={formAction} key={state.status === "success" ? state.at : "senha"} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={userId} />
      {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
      {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <Field id="nova-senha" label="Nova senha" error={e.senha} hint={SENHA_HINT}>
        <Input {...ariaFor("nova-senha", e.senha, true)} name="senha" type="password" autoComplete="new-password" required minLength={10} maxLength={72} />
      </Field>
      <SubmitButton variant="outline" pendingLabel="Redefinindo…">
        <KeyRound aria-hidden /> Redefinir senha
      </SubmitButton>
    </form>
  );
}

import { LogOut, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { salvarPreferenciasAction } from "@/app/actions/notificacoes";
import { signOutAction } from "@/app/actions/session";
import { NotificacoesAparelho } from "@/components/notificacoes/ativar";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { getVapidPublicKey } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/format";

import { NomeForm, SenhaForm } from "./account-forms";

export const metadata: Metadata = { title: "Minha conta" };

/** Configurações da conta (ambos os perfis). */
export default async function ContaPage() {
  const user = await requireUser();

  // Notificações: somente gestores.
  let publicKey: string | null = null;
  let prefs = { novo_cadastro: true, resumo_diario: true, lembrete_visita: true, alerta_atraso: true };
  if (user.role === "gestor") {
    try {
      publicKey = await getVapidPublicKey();
    } catch {
      publicKey = null;
    }
    const supabase = await createClient();
    const { data } = await supabase
      .from("notificacao_prefs")
      .select("novo_cadastro, resumo_diario, lembrete_visita, alerta_atraso")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) prefs = data;
  }
  const OPCOES = [
    { name: "novo_cadastro", label: "Novo cadastro", desc: "Quando a recepção cadastra (ou reabre) uma pessoa." },
    { name: "resumo_diario", label: "Resumo do dia (7h)", desc: "Visitas agendadas para hoje." },
    { name: "alerta_atraso", label: "Atrasos (9h)", desc: "Pessoas que passaram do prazo da etapa." },
    { name: "lembrete_visita", label: "Lembrete na véspera (19h)", desc: "Suas visitas de amanhã (só para quem fará a visita)." },
  ] as const;

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <PageHeader title="Minha conta" description="Dados de acesso e segurança." />

      <Card className="animate-enter">
        <CardHeader title="Perfil" />
        <div className="grid gap-5 p-4 md:p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">E-mail de acesso</dt>
              <dd className="break-all text-navy-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Perfil</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1.5">
                <Badge tone={user.role === "gestor" ? "navy" : "azure"}>{ROLE_LABEL[user.role]}</Badge>
                {user.role === "recepcao" ? (
                  <Badge>{user.canViewRecords ? "Consulta de todos os cadastros" : "Consulta dos próprios cadastros"}</Badge>
                ) : null}
              </dd>
            </div>
          </dl>
          <div className="border-t border-line pt-5">
            <NomeForm fullName={user.fullName} />
          </div>
        </div>
      </Card>

      {user.role === "gestor" ? (
        <Card className="animate-enter">
          <CardHeader title="Notificações" description="Avisos no celular, mesmo com o aplicativo fechado." />
          <div className="grid gap-5 p-4 md:p-6">
            {publicKey ? (
              <NotificacoesAparelho publicKey={publicKey} />
            ) : (
              <p className="text-sm text-muted">Notificações indisponíveis no momento.</p>
            )}
            <div className="border-t border-line pt-5">
              <p className="mb-3 text-sm font-medium text-navy-900">O que você quer receber</p>
              <ActionForm action={salvarPreferenciasAction}>
                {OPCOES.map((o) => (
                  <label key={o.name} className="flex cursor-pointer gap-3 rounded-md border border-line p-3.5 hover:bg-azure-50/60">
                    <Checkbox name={o.name} defaultChecked={prefs[o.name]} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-navy-900">{o.label}</span>
                      <span className="block text-[13px] text-muted">{o.desc}</span>
                    </span>
                  </label>
                ))}
                <div>
                  <SubmitButton variant="outline" pendingLabel="Salvando…">
                    Salvar preferências
                  </SubmitButton>
                </div>
              </ActionForm>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="animate-enter">
        <CardHeader title="Alterar senha" description="Por segurança, confirme a senha atual." />
        <div className="p-4 md:p-6">
          <SenhaForm />
        </div>
      </Card>

      <Card className="animate-enter">
        <CardHeader title="Sessão" />
        <div className="grid gap-4 p-4 md:p-6">
          <p className="flex items-start gap-2 text-sm text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-navy-700" aria-hidden />
            Ao sair, sua sessão é encerrada no servidor. Em aparelhos compartilhados, sempre saia ao terminar.
          </p>
          <form action={signOutAction}>
            <Button type="submit" variant="danger-outline" block className="sm:w-auto">
              <LogOut aria-hidden /> Sair do sistema
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

"use client";

import { Bell, BellOff, BellRing, Send, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

import { enviarTesteAction, removerAssinaturaAction, salvarAssinaturaAction } from "@/app/actions/notificacoes";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";

type Estado = "carregando" | "sem-suporte" | "negado" | "inativo" | "ativo";

function base64UrlParaBytes(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function suportado() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Estado das notificações neste aparelho e ações para ativar/desativar. */
function useNotificacoes(publicKey: string) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [pendente, startTransition] = useTransition();

  const atualizar = useCallback(async () => {
    if (!suportado()) return setEstado("sem-suporte");
    if (Notification.permission === "denied") return setEstado("negado");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setEstado(sub ? "ativo" : "inativo");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura do estado do navegador
    void atualizar();
  }, [atualizar]);

  const ativar = () =>
    startTransition(async () => {
      try {
        const permissao = await Notification.requestPermission();
        if (permissao !== "granted") {
          setEstado(permissao === "denied" ? "negado" : "inativo");
          return;
        }
        const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlParaBytes(publicKey) }));
        const res = await salvarAssinaturaAction(sub.toJSON());
        notify(res.message ?? "", res.status === "success" ? "success" : "error");
      } catch {
        notify("Não foi possível ativar as notificações neste aparelho.", "error");
      }
      await atualizar();
    });

  const desativar = () =>
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removerAssinaturaAction(sub.endpoint);
        await sub.unsubscribe();
      }
      notify("Notificações desativadas neste aparelho.");
      await atualizar();
    });

  const testar = () =>
    startTransition(async () => {
      const res = await enviarTesteAction();
      notify(res.message ?? "", res.status === "success" ? "success" : "error");
    });

  return { estado, pendente, ativar, desativar, testar };
}

/** Bloco completo (página Minha conta). */
export function NotificacoesAparelho({ publicKey }: { publicKey: string }) {
  const { estado, pendente, ativar, desativar, testar } = useNotificacoes(publicKey);

  if (estado === "carregando") return <p className="text-sm text-muted">Verificando este aparelho…</p>;

  if (estado === "sem-suporte") {
    return (
      <p className="text-sm text-muted">
        Este navegador não recebe notificações. No celular, use o aplicativo instalado na tela inicial (no iPhone, iOS 16.4
        ou mais recente).
      </p>
    );
  }

  if (estado === "negado") {
    return (
      <p className="text-sm text-warning">
        As notificações foram bloqueadas neste aparelho. Libere em <strong>Ajustes → Notificações → Recepção</strong>{" "}
        (iPhone) ou nas configurações do app (Android) e volte aqui.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-2 text-sm">
        {estado === "ativo" ? (
          <>
            <BellRing className="size-4 text-success" aria-hidden />
            <span className="text-navy-900">Notificações ativas neste aparelho.</span>
          </>
        ) : (
          <>
            <BellOff className="size-4 text-subtle" aria-hidden />
            <span className="text-muted">Notificações desligadas neste aparelho.</span>
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {estado === "ativo" ? (
          <>
            <Button variant="outline" onClick={testar} disabled={pendente}>
              <Send aria-hidden /> Enviar teste
            </Button>
            <Button variant="ghost" onClick={desativar} disabled={pendente}>
              <BellOff aria-hidden /> Desativar
            </Button>
          </>
        ) : (
          <Button onClick={ativar} disabled={pendente}>
            <Bell aria-hidden /> Ativar notificações
          </Button>
        )}
      </div>
    </div>
  );
}

/** Convite discreto no Painel, enquanto este aparelho não tiver notificações. */
export function ConviteNotificacoes({ publicKey }: { publicKey: string }) {
  const { estado, pendente, ativar } = useNotificacoes(publicKey);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência local
      if (window.localStorage.getItem("recepcao:convite-notificacoes") === "fechado") setFechado(true);
    } catch {
      // ignora
    }
  }, []);

  if (fechado || estado !== "inativo") return null;

  return (
    <div className="flex animate-enter items-center gap-3 rounded-lg border border-azure-200 bg-azure-50 p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-navy-700">
        <Bell className="size-[18px]" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-sm text-navy-900">
        Receba avisos de novos cadastros, visitas do dia e atrasos neste aparelho.
      </p>
      <Button size="sm" onClick={ativar} disabled={pendente}>
        Ativar
      </Button>
      <button
        type="button"
        onClick={() => {
          setFechado(true);
          try {
            window.localStorage.setItem("recepcao:convite-notificacoes", "fechado");
          } catch {
            // ignora
          }
        }}
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-white"
        aria-label="Dispensar"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

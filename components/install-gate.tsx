"use client";

import { Download, EllipsisVertical, PlusSquare, Share } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/brand";

/**
 * Detecção executada ANTES da primeira pintura (script inline com nonce no
 * <head>): em celulares/tablets, se o sistema não estiver aberto como
 * aplicativo instalado, marca <html data-gate="instalar"> e o CSS esconde
 * todo o conteúdo, mostrando só as instruções de instalação.
 *
 * Observação: é uma regra de uso (experiência), não uma barreira de
 * segurança — a segurança continua no servidor e no banco.
 */
export const INSTALL_GATE_SCRIPT = `(function(){try{
var ua=navigator.userAgent||"";
var movel=/Android|iPhone|iPad|iPod|Mobile/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
var mm=function(q){return window.matchMedia&&window.matchMedia(q).matches;};
var instalado=mm("(display-mode: standalone)")||mm("(display-mode: fullscreen)")||mm("(display-mode: minimal-ui)")||navigator.standalone===true;
if(movel&&!instalado){document.documentElement.setAttribute("data-gate","instalar");}
}catch(e){}})();`;

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white">{n}</span>
      <span className="pt-0.5 text-[15px] leading-relaxed text-ink">{children}</span>
    </li>
  );
}

export function InstallGate() {
  const [plataforma, setPlataforma] = useState<"ios" | "android" | "outro">("outro");
  const [webview, setWebview] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção do aparelho
    setPlataforma(ios ? "ios" : /Android/i.test(ua) ? "android" : "outro");
    // Navegadores internos (WhatsApp, Instagram, Facebook) não instalam apps.
    setWebview(/FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <div id="instalar-app" role="dialog" aria-modal="true" aria-labelledby="instalar-titulo" className="pt-safe pb-safe min-h-dvh bg-white">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <BrandMark className="size-14" />
        <h1 id="instalar-titulo" className="mt-6 text-2xl font-semibold tracking-tight text-navy-900">
          Instale o aplicativo
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          No celular, o Recepção funciona somente como aplicativo instalado. É rápido, gratuito e permite receber
          notificações.
        </p>

        {webview ? (
          <div className="mt-6 rounded-lg border border-[#f2e0b8] bg-warning-bg p-4 text-[15px] text-warning">
            Você abriu o link dentro de outro aplicativo. Toque nos <strong>três pontos</strong> ou em{" "}
            <strong>Compartilhar</strong> e escolha <strong>Abrir no navegador</strong>
            {plataforma === "ios" ? " (Safari)" : " (Chrome)"}. Depois siga os passos abaixo.
          </div>
        ) : null}

        {plataforma === "ios" ? (
          <ol className="mt-7 grid gap-4">
            <Passo n={1}>
              Abra este endereço no <strong>Safari</strong>.
            </Passo>
            <Passo n={2}>
              Toque em <Share className="mb-1 inline size-[18px] text-navy-700" aria-label="Compartilhar" />{" "}
              <strong>Compartilhar</strong>, na barra de baixo.
            </Passo>
            <Passo n={3}>
              Escolha <PlusSquare className="mb-1 inline size-[18px] text-navy-700" aria-hidden />{" "}
              <strong>Adicionar à Tela de Início</strong> e toque em <strong>Adicionar</strong>.
            </Passo>
            <Passo n={4}>
              Abra o <strong>Recepção</strong> pelo ícone na tela de início.
            </Passo>
          </ol>
        ) : (
          <>
            {prompt ? (
              <button
                type="button"
                onClick={async () => {
                  await prompt.prompt();
                  setPrompt(null);
                }}
                className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-navy-900 text-base font-medium text-white hover:bg-navy-800"
              >
                <Download className="size-5" aria-hidden /> Instalar aplicativo
              </button>
            ) : null}
            <ol className="mt-7 grid gap-4">
              <Passo n={1}>
                Abra este endereço no <strong>Chrome</strong>.
              </Passo>
              <Passo n={2}>
                Toque em <EllipsisVertical className="mb-1 inline size-[18px] text-navy-700" aria-label="menu" />{" "}
                (canto superior direito).
              </Passo>
              <Passo n={3}>
                Escolha <strong>Instalar aplicativo</strong> (ou <strong>Adicionar à tela inicial</strong>) e confirme.
              </Passo>
              <Passo n={4}>
                Abra o <strong>Recepção</strong> pelo ícone na tela inicial.
              </Passo>
            </ol>
          </>
        )}

        <p className="mt-8 rounded-md bg-surface px-4 py-3 text-[13px] text-muted">
          Já instalou? Feche esta página e abra o Recepção pelo ícone na tela inicial do celular.
        </p>
      </div>
    </div>
  );
}

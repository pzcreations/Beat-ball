import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { startOfZonedDay } from "@/lib/dates";
import { env } from "@/lib/env";
import { formatHora } from "@/lib/format";
import { enviarPara, gestoresAtivos } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Chamado a cada hora pelo agendador do Supabase (pg_cron + pg_net).
 * Autenticação: segredo gerado no banco (`sistema_config.cron_secret`).
 *
 * Horários (São Paulo):
 *   07h → resumo das visitas do dia (todos os gestores)
 *   09h → alerta de atendimentos atrasados (todos os gestores)
 *   19h → lembrete das visitas de amanhã (somente quem fará a visita)
 */
export const dynamic = "force-dynamic";

const HORARIOS = { resumo_diario: 7, alerta_atraso: 9, lembrete_visita: 19 } as const;
type Tipo = keyof typeof HORARIOS;

function seguroIgual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function horaLocal(tz: string, d = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(d));
}

function diaLocal(tz: string, d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

const resumir = (itens: string[], max = 4) =>
  itens.length <= max ? itens.join(" · ") : `${itens.slice(0, max).join(" · ")} e mais ${itens.length - max}`;

export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  const { data: cfg } = await admin.from("sistema_config").select("cron_secret").eq("id", true).single();
  const auth = request.headers.get("authorization") ?? "";
  if (!cfg?.cron_secret || !seguroIgual(auth, `Bearer ${cfg.cron_secret}`)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const tz = env.timezone;
  const hora = horaLocal(tz);
  const hoje = diaLocal(tz);
  const forcado = request.nextUrl.searchParams.get("tipo") as Tipo | null;
  const devidos = (Object.keys(HORARIOS) as Tipo[]).filter((t) => (forcado ? t === forcado : HORARIOS[t] === hora));
  const resultado: Record<string, unknown> = { hora, devidos };

  for (const tipo of devidos) {
    // Evita envio duplicado no mesmo dia (exceto quando forçado manualmente).
    if (!forcado) {
      const { data: marcado } = await admin.rpc("marcar_envio", { p_tipo: tipo, p_dia: hoje });
      if (!marcado) {
        resultado[tipo] = "já enviado hoje";
        continue;
      }
    }

    if (tipo === "resumo_diario") {
      const { data } = await admin
        .from("visitas")
        .select("agendada_para, pessoa:pessoas(nome)")
        .eq("situacao", "agendada")
        .gte("agendada_para", startOfZonedDay(tz, 0).toISOString())
        .lt("agendada_para", startOfZonedDay(tz, -1).toISOString())
        .order("agendada_para");
      const visitas = data ?? [];
      if (visitas.length === 0) {
        resultado[tipo] = "sem visitas hoje";
        continue;
      }
      resultado[tipo] = await enviarPara(await gestoresAtivos(), "resumo_diario", {
        title: visitas.length === 1 ? "1 visita hoje" : `${visitas.length} visitas hoje`,
        body: resumir(visitas.map((v) => `${formatHora(v.agendada_para)} ${v.pessoa?.nome.split(" ")[0] ?? ""}`)),
        url: "/gestor/agenda",
        tag: "resumo_diario",
      });
    }

    if (tipo === "alerta_atraso") {
      const { data: total } = await admin.rpc("contar_atrasados", { p_tz: tz });
      if (!total) {
        resultado[tipo] = "nenhum atraso";
        continue;
      }
      resultado[tipo] = await enviarPara(await gestoresAtivos(), "alerta_atraso", {
        title: "Atendimentos atrasados",
        body: total === 1 ? "1 pessoa passou do prazo da etapa." : `${total} pessoas passaram do prazo da etapa.`,
        url: "/gestor",
        tag: "alerta_atraso",
      });
    }

    if (tipo === "lembrete_visita") {
      const { data } = await admin
        .from("visitas")
        .select("agendada_para, endereco, visitante_id, pessoa:pessoas(nome)")
        .eq("situacao", "agendada")
        .gte("agendada_para", startOfZonedDay(tz, -1).toISOString())
        .lt("agendada_para", startOfZonedDay(tz, -2).toISOString())
        .order("agendada_para");
      const porVisitante = new Map<string, string[]>();
      for (const v of data ?? []) {
        const linha = `${formatHora(v.agendada_para)} ${v.pessoa?.nome ?? ""} (${v.endereco})`;
        porVisitante.set(v.visitante_id, [...(porVisitante.get(v.visitante_id) ?? []), linha]);
      }
      let enviados = 0;
      for (const [visitante, linhas] of porVisitante) {
        const r = await enviarPara([visitante], "lembrete_visita", {
          title: linhas.length === 1 ? "Visita amanhã" : `${linhas.length} visitas amanhã`,
          body: resumir(linhas, 3),
          url: "/gestor/agenda?minhas=1",
          tag: "lembrete_visita",
        });
        enviados += r.enviados;
      }
      resultado[tipo] = { enviados };
    }
  }

  return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
}

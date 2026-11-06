import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { listPessoasForExport } from "@/lib/data/pessoas";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { filtrosSchema } from "@/lib/validation";

/**
 * Exportação CSV (somente gestor).
 *  - Papel verificado no servidor e, de novo, pelo RLS do banco.
 *  - Bloqueia requisições originadas em outros sites (Sec-Fetch-Site).
 *  - Neutraliza injeção de fórmulas em planilhas (=, +, -, @).
 *  - Registra a exportação no histórico.
 */
export async function GET(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ erro: "Origem não permitida." }, { status: 403 });
  }

  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ erro: "Falha de conexão." }, { status: 503 });
  }
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!user.active || user.role !== "gestor") return NextResponse.json({ erro: "Acesso negado." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const filtros = filtrosSchema.parse({
    q: sp.get("q") ?? undefined,
    periodo: sp.get("periodo") ?? undefined,
    ordem: sp.get("ordem") ?? undefined,
    responsavel: sp.get("responsavel") || undefined,
  });

  let rows;
  try {
    rows = await listPessoasForExport(filtros);
  } catch {
    return NextResponse.json({ erro: "Falha ao gerar a exportação." }, { status: 503 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_evento", {
    p_action: "dados.exportados",
    p_details: {
      linhas: rows.length,
      filtros: { busca: filtros.q ? "sim" : "não", periodo: filtros.periodo ?? "todos" },
    },
  });
  // Sem registro de auditoria, não há exportação.
  if (error) return NextResponse.json({ erro: "Não foi possível registrar a exportação." }, { status: 503 });

  const csv = toCsv([
    ["Nome", "Número", "Cadastrado em", "Responsável", "Última atualização"],
    ...rows.map((r) => [
      r.nome,
      r.numero,
      formatDateTime(r.created_at),
      r.autor?.full_name ?? "",
      formatDateTime(r.updated_at),
    ]),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recepcao-cadastros-${stamp}.csv"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cell(value: string) {
  let v = value;
  // Evita que o Excel/Sheets interprete o conteúdo como fórmula.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[";\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

function toCsv(rows: string[][]) {
  // Ponto e vírgula: padrão do Excel em português.
  return rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

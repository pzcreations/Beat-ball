#!/usr/bin/env bash
# Testa a migration e as políticas de segurança (RLS) num PostgreSQL local
# descartável, usando uma simulação mínima do ambiente Supabase.
#
# Requisitos: PostgreSQL 15+ instalado (initdb, pg_ctl, psql) com a extensão
# contrib (unaccent, pg_trgm). Uso:  ./scripts/test-db.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
PORT="${PGTEST_PORT:-54329}"
WORK="$(mktemp -d)"
RUN_AS=()

# initdb não roda como root.
if [ "$(id -u)" = "0" ]; then
  chown postgres "$WORK"
  RUN_AS=(sudo -u postgres)
fi

cleanup() {
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/pg.log" -w start >/dev/null

PSQL=("${RUN_AS[@]}" "$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -A)

"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ aplicando $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
for t in "$ROOT"/supabase/tests/[1-9]*.sql; do
  echo "→ $(basename "$t")"
  "${PSQL[@]}" -f "$t" 2>&1 \
    | sed 's/^psql:[^ ]* NOTICE:  /  /' \
    | grep -vE '^$|^\{"(sub|id|etapa_id)"'
done
echo "======================================"
echo "Todos os testes de banco passaram."
echo "======================================"

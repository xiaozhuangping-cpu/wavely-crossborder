#!/usr/bin/env bash
# 数据库测试：在 DATABASE_URL 指向的【空库】里执行 setup → 全部迁移 → tests/*.sql
# 用法：DATABASE_URL=postgres://postgres@127.0.0.1:5432/wavely_test ./supabase/tests/run.sh
# 警告：会创建表与函数，只能指向一次性的测试库，切勿指向线上
set -euo pipefail
: "${DATABASE_URL:?请设置 DATABASE_URL（一次性的空测试库）}"
case "$DATABASE_URL" in *supabase.co*|*supabase.com*) echo "拒绝在 Supabase 线上库运行测试" >&2; exit 2;; esac

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$DIR/.."
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -f "$DIR/setup.sql"
for f in "$ROOT"/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  # pg_cron 扩展在普通 Postgres 中不可用，由 setup.sql 的 cron.schedule 替身代替
  sed -E 's/^create extension if not exists pg_cron.*$//' "$f" | "${PSQL[@]}" -o /dev/null -f -
done

fail=0
for t in "$DIR"/[0-9]*.sql; do
  if out=$("${PSQL[@]}" -f "$t" 2>&1); then echo "ok       $(basename "$t")"
  else echo "FAIL     $(basename "$t")"; echo "$out" | sed 's/^/    /'; fail=1; fi
done
exit $fail

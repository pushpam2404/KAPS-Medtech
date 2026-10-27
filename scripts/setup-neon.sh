#!/usr/bin/env bash
# Prepares a fresh PostgreSQL database (written for a free Neon project):
# loads the schema, adds the demo data, and checks the app can read it.
#
#   export DATABASE_URL='postgresql://...'      # copy it from the Neon dashboard
#   ./scripts/setup-neon.sh
#
# The URL is read from the environment only and is never printed.
# It DROPS and recreates every table, so use an empty database.

set -uo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Export it first (see the comment at the top of this file)." >&2
  exit 1
fi
case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *) echo "DATABASE_URL does not start with postgresql://" >&2; exit 1 ;;
esac

# Hide the URL and its host name if a tool echoes them in an error message.
redact() {
  node -e '
    const u = process.env.DATABASE_URL; let host = "";
    try { host = new URL(u).hostname; } catch {}
    let s = require("fs").readFileSync(0, "utf8");
    for (const secret of [u, host].filter(Boolean)) s = s.split(secret).join("<hidden>");
    process.stdout.write(s);'
}

run() {
  local label="$1"; shift
  echo "-> $label"
  local out
  out="$("$@" 2>&1)"; local code=$?
  printf '%s\n' "$out" | redact | sed 's/^/   /'
  if [ $code -ne 0 ]; then
    if printf '%s' "$out" | grep -qiE 'self.signed|unable to verify|certificate'; then
      echo "   The database certificate is not trusted by Node. Neon works as is; for Supabase set DATABASE_CA" >&2
      echo "   to its CA certificate, or export DATABASE_SSL=relaxed and run this again." >&2
    fi
    echo "Stopped: $label failed." >&2
    exit 1
  fi
}

[ -d node_modules ] || run "Installing dependencies" npm ci
run "Creating tables" npm run --silent db:init
run "Adding demo data" env ALLOW_DEMO_SEED=1 npm run --silent db:seed:demo
run "Reading the data back" node -e '
  require("./backend/db").query("SELECT (SELECT count(*) FROM Users) users, (SELECT count(*) FROM Appointments) appointments")
    .then((r) => { console.log(r.rows[0].users + " users, " + r.rows[0].appointments + " appointments"); process.exit(0); })
    .catch((e) => { console.error(e.message); process.exit(1); });'

cat <<'NEXT'

The database is ready. Next, give the app its settings on Vercel and redeploy.
Each command asks for (or reads from the pipe) the value; nothing is printed.

  printf %s "$DATABASE_URL" | vercel env add DATABASE_URL production
  openssl rand -hex 32     | vercel env add JWT_SECRET production
  vercel deploy --prod

If DATABASE_URL or JWT_SECRET already exist there, remove the old ones first:

  vercel env rm DATABASE_URL production --yes
  vercel env rm JWT_SECRET production --yes

Then open https://kaps-medtech.vercel.app/api/health and expect {"status":"OK",...}.
Demo logins are on the sign-in page. Set DEMO_MODE=off on Vercel to hide them later.
NEXT

#!/usr/bin/env bash
# x1F Lead-Gen — One-Shot-Setup für Secrets
# Setzt LEADS_API_KEY in Supabase + GitHub und (optional) ANTHROPIC_API_KEY in Supabase

set -euo pipefail

SUPABASE_PROJECT_REF="wlxolfkhkxembiuofmfa"
GH_REPO="Lomtech/accountmanagementdashboard"

echo "🔐 x1F Secrets Setup"
echo ""

# 1) LEADS_API_KEY laden
if [[ ! -f .leads-secrets.local ]]; then
  echo "→ Generiere neuen LEADS_API_KEY"
  openssl rand -hex 32 > .leads-secrets.local
  chmod 600 .leads-secrets.local
fi
LEADS_KEY=$(cat .leads-secrets.local)
echo "✓ LEADS_API_KEY geladen (… ${LEADS_KEY: -8})"
echo ""

# 2) GitHub Secret
echo "🐙 GitHub Secret setzen ($GH_REPO)..."
if ! gh auth status >/dev/null 2>&1; then
  echo "  Du musst dich einmalig bei GitHub einloggen."
  echo "  Wähle: GitHub.com → HTTPS → Login with a web browser"
  gh auth login
fi
gh secret set LEADS_API_KEY -b "$LEADS_KEY" -R "$GH_REPO"
echo "✓ GitHub Actions Secret LEADS_API_KEY gesetzt"
echo ""

# 3) Supabase Secret
echo "🗄  Supabase Edge-Function Secrets setzen..."
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] && ! supabase projects list >/dev/null 2>&1; then
  echo "  Du musst dich einmalig bei Supabase einloggen."
  supabase login
fi

supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" "LEADS_API_KEY=$LEADS_KEY"
echo "✓ Supabase Secret LEADS_API_KEY gesetzt"

# Optional: Anthropic Key
echo ""
echo "🤖 Optional: ANTHROPIC_API_KEY für LLM-Pitch-Generator"
read -p "  Anthropic Key eingeben (oder leer lassen zum Überspringen): " ANTH_KEY
if [[ -n "$ANTH_KEY" ]]; then
  supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" "ANTHROPIC_API_KEY=$ANTH_KEY"
  echo "✓ Supabase Secret ANTHROPIC_API_KEY gesetzt"
fi

echo ""
echo "🎉 Fertig! Du kannst jetzt:"
echo "  • Im Dashboard ✏️ klicken und mit dem Token aus .leads-secrets.local einloggen"
echo "  • Auf GitHub: Actions → x1F Lead Scraper → Run workflow"
echo "  • Im Dashboard ✨ klicken (wenn ANTHROPIC_API_KEY gesetzt) für AI-Pitch"
echo ""
echo "🔑 Dein API-Key:"
echo "    $LEADS_KEY"

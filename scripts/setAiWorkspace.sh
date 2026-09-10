#!/usr/bin/env bash
# Ajoute l'ID de workspace Anthropic à .env.local, sans toucher à la clé qui s'y trouve déjà.
#
#   bash scripts/setAiWorkspace.sh wrkspc_01AbCdEf…
#
# Requis uniquement quand la clé appartient à l'organisation plutôt qu'à un workspace : l'API
# refuse alors la requête en nommant cet en-tête. Une clé rattachée à un workspace n'en a pas besoin.
set -euo pipefail
cd "$(dirname "$0")/.."

ID="${1:-}"
if [ -z "${ID}" ]; then
  read -r -p "ID du workspace (wrkspc_…) : " ID
fi
if [[ "${ID}" != wrkspc_* ]]; then
  echo "Cet identifiant ne commence pas par « wrkspc_ ». Rien n'a été écrit." >&2
  exit 1
fi

touch .env.local
# Réécrit proprement : les lignes existantes sont retirées avant d'ajouter, pour qu'un deuxième
# appel corrige au lieu d'empiler.
grep -v -E '^(VITE_)?ANTHROPIC_WORKSPACE_ID=' .env.local > .env.local.tmp || true
printf 'ANTHROPIC_WORKSPACE_ID=%s\nVITE_ANTHROPIC_WORKSPACE_ID=%s\n' "${ID}" "${ID}" >> .env.local.tmp
mv .env.local.tmp .env.local
chmod 600 .env.local

echo "Workspace enregistré : ${ID}"
awk -F= '{ printf "  %s = %d caractères\n", $1, length($2) }' .env.local

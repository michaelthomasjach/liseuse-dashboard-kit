#!/usr/bin/env bash
# Écrit la clé Anthropic dans .env.local sans qu'elle apparaisse dans l'historique du shell.
#
#   bash scripts/setAiKey.sh
#
# La clé est saisie sans écho (rien ne s'affiche pendant que vous tapez ou collez), écrite dans
# .env.local — déjà ignoré par git — et rien d'autre. Aucune trace ailleurs.
set -euo pipefail
cd "$(dirname "$0")/.."

read -r -s -p "Collez la clé Anthropic (rien ne s'affichera), puis Entrée : " KEY
echo

if [ -z "${KEY}" ]; then
  echo "Aucune clé saisie — rien n'a été écrit." >&2
  exit 1
fi
if [[ "${KEY}" != sk-ant-* ]]; then
  echo "Cette clé ne commence pas par « sk-ant- ». Rien n'a été écrit." >&2
  exit 1
fi

# Deux lignes, la même clé : la première pour les scripts Node, la seconde pour Storybook (Vite
# n'expose au navigateur que les variables préfixées VITE_).
printf 'ANTHROPIC_API_KEY=%s\nVITE_ANTHROPIC_API_KEY=%s\n' "${KEY}" "${KEY}" > .env.local
chmod 600 .env.local

echo "Écrit dans .env.local (${#KEY} caractères)."
git check-ignore -q .env.local && echo "Bien ignoré par git." || echo "ATTENTION : ce fichier n'est PAS ignoré par git." >&2

#!/usr/bin/env bash
# Instala as 13 skills do infoproduto "Do zero ao app" no Claude Code.
set -euo pipefail

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO="${1:-$HOME/.claude/skills}"

SKILLS=(escopo-de-uma-pagina ambiente-zero stack-minima modelo-de-dados
        primeira-tela-viva fluxo-completo quem-entra-e-quem-ve
        dados-que-ja-existem nao-quebra no-ar-e-vivo
        socorro-quebrou relatorios-que-respondem ia-dentro-do-app)

mkdir -p "$DESTINO"

for s in "${SKILLS[@]}"; do
  if [ ! -f "$ORIGEM/$s/SKILL.md" ]; then
    echo "  ! $s — SKILL.md nao encontrado, pulando"
    continue
  fi
  rm -rf "${DESTINO:?}/$s"
  cp -r "$ORIGEM/$s" "$DESTINO/$s"
  echo "  ok  $s"
done

echo
echo "Instaladas em: $DESTINO"
echo "Abra o Claude Code e rode /skills para conferir."

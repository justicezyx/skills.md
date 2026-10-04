#!/usr/bin/env bash
# Install repo skills and commands into ~/.cursor/ for local Cursor use.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DST="${HOME}/.cursor/skills"
COMMANDS_DST="${HOME}/.cursor/commands"

mkdir -p "${SKILLS_DST}" "${COMMANDS_DST}"

if [[ -d "${ROOT}/skills" ]]; then
  for skill_dir in "${ROOT}/skills"/*/; do
    [[ -d "${skill_dir}" ]] || continue
    name="$(basename "${skill_dir}")"
    rm -rf "${SKILLS_DST}/${name}"
    cp -a "${skill_dir%/}" "${SKILLS_DST}/${name}"
  done
fi

if [[ -d "${ROOT}/commands" ]]; then
  cp -a "${ROOT}/commands/." "${COMMANDS_DST}/"
fi

echo "Installed skills to ${SKILLS_DST}"
echo "Installed commands to ${COMMANDS_DST}"
echo ""
echo "For Cloud Agents: Cursor → Settings → Agents → Context and Tools"
echo "→ enable \"Sync Skills for Cloud Agents\" (skills in ~/.cursor/skills/ only)."

# skills.md

Personal Cursor **skills** and **commands** for Yaxiong (yxzhao).

## Layout

| Path | Installs to |
| --- | --- |
| `skills/<name>/SKILL.md` | `~/.cursor/skills/<name>/` |
| `commands/*.md` | `~/.cursor/commands/` |

## Install (local Mac)

From a clone of this repository:

```bash
./install-to-cursor.sh
```

Or copy manually:

```bash
mkdir -p ~/.cursor/skills ~/.cursor/commands
cp -a skills/* ~/.cursor/skills/
cp -a commands/. ~/.cursor/commands/
```

## Cloud sync (Cloud Agents)

1. Install skills into `~/.cursor/skills/` on your machine (above).
2. In **Cursor → Settings → Agents → Context and Tools**, turn on **Sync Skills for Cloud Agents**.
3. Confirm when prompted. Only `~/.cursor/skills/` syncs; commands in `~/.cursor/commands/` do not. To use a command on Cloud Agents, commit it under `.cursor/commands/` in a project repo or run `/migrate-to-skills` to convert commands into syncable skills.

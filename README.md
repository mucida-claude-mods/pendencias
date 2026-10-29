# pendencias

*"Pending"* — a Claude Code mod that opens a **pane listing the chats that ended waiting on you**, per project.

When a chat finishes its answer asking for something (an OK, a test, a decision, "should I proceed?"), it goes into the list with its title, what it asked, how long ago, and 🔥 / ❄️ for whether its prompt cache is probably still warm (under 1 hour). Each row has a button to dismiss it. A chat that later ends without asking anything leaves the list on its own; entries older than 14 days are dropped.

Open it with `/pendencias`. The texts on screen are in Portuguese; the detection understands Portuguese and a few English phrases ("let me know", "should I", "please confirm"…).

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install pendencias --marketplace mucida-claude-mods/pendencias
```

Answer `y` to add the marketplace, then choose a scope (user scope shows it in every project).

## How it works

Detection is a regular expression over the final answer: no model call, no tokens. The chat title comes from the `customTitle` saved in the session transcript under `~/.claude/projects/`. Entries are kept in the mod's own store, so all your sessions share the list.

## What it accesses

Hooks `session.start`, `command.run` (`/pendencias`), `turn.start`, `turn.complete` and `ui.render` (`Pane`). Calls `$.store`, `$.state`, `$.clock.every`, `$.session`, `$.command.register`, `$.ui.open`, `$.ui.toast` and runs `grep` on the session transcript to read its title. No network.

## Development

```bash
claude plugin validate .
claude plugin test .
```

## Em português

Painel com os chats que terminaram pedindo algo de você (um ok, um teste, uma decisão), separados por projeto: título, o que pediram, há quanto tempo e se o cache ainda está quente (🔥) ou frio (❄️). Cada um tem botão para dispensar. Abre com `/pendencias`. A detecção é por texto, sem gastar tokens.

## More mods by the same author / Mais mods do mesmo autor

All in one place: **[github.com/mucida-claude-mods](https://github.com/mucida-claude-mods)**

| Mod | What it does |
| --- | --- |
| [warm-me](https://github.com/mucida-claude-mods/warm-me) | Pixel-art fire showing whether the prompt cache is still warm |
| [critical-decisions](https://github.com/mucida-claude-mods/critical-decisions) | Shows the critical decisions the agent made without asking |
| [indicador-de-contexto](https://github.com/mucida-claude-mods/indicador-de-contexto) | Warns when to split or compact the chat (250k / 400k) |
| [novo-chat-ou-aqui](https://github.com/mucida-claude-mods/novo-chat-ou-aqui) | Should this extra step run here or in a new chat? |
| [pendencias](https://github.com/mucida-claude-mods/pendencias) | Chats that ended waiting on you |
| [telinha-mcp](https://github.com/mucida-claude-mods/telinha-mcp) | Which MCP the agent just called, in plain words |
| [faixa-de-terreno](https://github.com/mucida-claude-mods/faixa-de-terreno) | Branch, issue, dirty files and commits ahead of main |

## License

MIT

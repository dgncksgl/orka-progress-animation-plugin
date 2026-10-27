# orka

A Claude Code mod that shows how far a turn has come. While Claude works, an orca swims in a band above the prompt. Every tool call it makes counts as a step, and the orca grows with the steps.

| Stage | Steps |
|---|---|
| Calf | 0 |
| Juvenile | 2 |
| Adult | 5 |
| Giant | 10 |
| Legend | 17 |

A caption under the orca shows the stage, the step count and how many steps are left to the next stage, for example `Orca Adult ●●●○○ · 7 steps · next: Giant (3 to go)`. The count starts over with each prompt, and the band disappears when the turn ends.

## Requirements

- Claude Code with mods (function hook modules). Tested on 2.1.311.
- A terminal session. The band is drawn only in the terminal, not in the desktop app or IDE panels.
- A terminal with 256 colours. Every colour is an exact xterm-256 palette entry, so terminals without truecolor (for example the JetBrains terminal) draw the same picture.

## Install

At the prompt of a terminal session:

```
/plugin install orka --marketplace dgncksgl/orka-progress-animation-plugin
```

Answer `y` to add the marketplace, then pick a scope (user is the default). The mod is active right away.

From your shell:

```bash
claude plugin install orka --marketplace dgncksgl/orka-progress-animation-plugin
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `dgncksgl/orka-progress-animation-plugin`, then Add plugin.

If your machine has no GitHub SSH key, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` before installing.

## Update

The plugin has no `version` field, so every new commit counts as an update. Run both commands in your shell, in this order:

```bash
claude plugin marketplace update orka-progress-animation
claude plugin update orka@orka-progress-animation
```

The first fetches the new commit but leaves the installed copy on the old one. The second installs it. Run alone, the second reports `already at the latest version`.

The new version loads in your next session, or after `/reload-plugins` in a running one.

## Uninstall

```bash
claude plugin uninstall orka@orka-progress-animation
claude plugin marketplace remove orka-progress-animation
```

## Repository layout

```
.claude-plugin/marketplace.json   marketplace catalog
.claude-plugin/plugin.json        plugin manifest
hooks/hooks.json                  points Claude Code at the hooks module
hooks/register.tsx                hooks: counts tool calls, draws the band above the prompt
hooks/orca.ts                     draws the scene: sea, orca, stages
types/index.d.ts                  the state the mod keeps (tool call count)
tests/orca.test.ts                tests for growth, size, motion and the band
```

## Development

Run the checks:

```bash
claude plugin validate .
claude plugin test .
```

To try local changes without pushing, start a session with the folder loaded:

```bash
claude --plugin-dir .
```

## License

[MIT](LICENSE)

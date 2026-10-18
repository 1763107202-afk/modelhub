# Engineering Five Skills — ChatGPT Plugin Creator

This branch packages five **instruction-only** adapter skills as a personal plugin candidate. The package contains no installed upstream binaries and no connected services.

## Files

- `plugin.json`: portable Agent Plugins manifest.
- `.codex-plugin/plugin.json`: compatibility manifest for plugin tooling.
- `skills/*/SKILL.md`: five original workflow instruction adapters.
- `gateway/`: an experimental REST adapter gateway. **Not MCP-compatible yet**, and not deployed.
- Repository root `.agents/plugins/marketplace.json`: Git-backed plugin candidate for compatible Codex/desktop workflows, not automatically a web plugin.

## Create with Plugin Creator

1. In ChatGPT, switch to **Work** when available, and address `@plugin-creator`.
2. Provide the GitHub repo URL and specify **branch** `chatgpt-skills-integration`, folder `integrations/chatgpt-skills`.
3. Ask it to create a **personal instruction-only plugin first**, using the five `skills/*/SKILL.md` guides, and to review the manifests.
4. Confirm the plugin appears under Personal in the Plugins directory, enable it, and invoke it with `@` in a fresh session.
5. Test each one with a real instruction-only task; do not expect an upstream app to run yet.

If Plugin Creator cannot read the repository, transfer the five SKILL.md contents as source files (without credentials). Do not use the existing gateway's OpenAPI endpoint as an MCP URL: its only available endpoints are /health and /v1/execute.

## Live runtime integration prerequisite

To provide live VoiceStudio, MiroFish, Agent-Reach CLI or Archify rendering, separately deploy an authorized adapter, validate API calls and permissions, then create a real Streamable HTTP MCP server under a verified HTTPS domain and register it as a custom ChatGPT app. After ChatGPT returns a `plugin_asdk_app...` identifier, use Plugin Creator to attach that registered app to this bundle. A JSON instruction skill alone cannot launch a Windows process from the web.

## Licensing and security

These five guidance files were independently written and link to upstream repositories. No upstream code or assets were copied. Respect third-party licenses (including VoiceStudio AGPL-3.0) and model/voice consent. Do not commit OAuth tokens, cookies, key material or private recordings. Do not confuse successful manifest parsing with actual third-party functionality.

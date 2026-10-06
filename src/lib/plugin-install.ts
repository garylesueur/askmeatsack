export const MARKETPLACE_REPOSITORY = "garylesueur/meatsack-marketplace";
export const MARKETPLACE_HREF = `https://github.com/${MARKETPLACE_REPOSITORY}`;

export const PLUGIN_INSTALL = {
  displayName: "askmeatsack.com",
  examplePrompt: "Ask me the questions you need answered before you start.",
  codex: `codex plugin marketplace add ${MARKETPLACE_REPOSITORY}`,
  claudeMarketplace: `/plugin marketplace add ${MARKETPLACE_REPOSITORY}`,
  claudePlugin: `/plugin install askmeatsack@meatsack`,
  claude: `/plugin marketplace add ${MARKETPLACE_REPOSITORY}\n/plugin install askmeatsack@meatsack`,
  cursor: `git clone ${MARKETPLACE_HREF}.git\nmkdir -p ~/.cursor/plugins/local/askmeatsack\ncp -R meatsack-marketplace/plugins/askmeatsack/. ~/.cursor/plugins/local/askmeatsack/`,
};

export function pluginInstallMarkdown(origin = "https://askmeatsack.com"): string {
  return `## Install plugin

Use the [installation guide](${origin}/install) for step-by-step setup and copyable commands.

The [Meatsack marketplace](${MARKETPLACE_HREF}) includes askmeatsack.com, showmeatsack.com, and sharemeatsack.com. Each plugin packages its hosted MCP connection and workflow skill. Install the ones you need.

### Codex

\`\`\`sh
${PLUGIN_INSTALL.codex}
\`\`\`

Restart the desktop app, open Plugins, choose Meatsack, then install ${PLUGIN_INSTALL.displayName}. Adding the marketplace makes all three plugins available; install the ones you need.

### Claude Code

\`\`\`text
${PLUGIN_INSTALL.claude}
\`\`\`

Confirm the Claude Code install in the plugin panel, then start a new session.

### Cursor

On Teams or Enterprise, a team admin opens Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo. Use ${MARKETPLACE_HREF}, review the plugins, set access, and save. Install ${PLUGIN_INSTALL.displayName} from Customize.

For a local install:

\`\`\`sh
${PLUGIN_INSTALL.cursor}
\`\`\`

Restart Cursor or run Developer: Reload Window after copying the plugin. Confirm its skill and MCP server in Customize. Local plugin imports must be allowed.
`;
}

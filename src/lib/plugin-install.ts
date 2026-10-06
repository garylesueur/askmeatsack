export const MARKETPLACE_REPOSITORY = "garylesueur/meatsack-marketplace";
export const MARKETPLACE_HREF = `https://github.com/${MARKETPLACE_REPOSITORY}`;

export const PLUGIN_INSTALL = {
  displayName: "askmeatsack.com",
  codex: `codex plugin marketplace add ${MARKETPLACE_REPOSITORY}`,
  claude: `/plugin marketplace add ${MARKETPLACE_REPOSITORY}\n/plugin install askmeatsack@meatsack`,
  cursor: `git clone ${MARKETPLACE_HREF}.git\nmkdir -p ~/.cursor/plugins/local\nln -s "$PWD/meatsack-marketplace/plugins/askmeatsack" ~/.cursor/plugins/local/askmeatsack`,
};

export function pluginInstallMarkdown(): string {
  return `## Install plugin

The [Meatsack marketplace](${MARKETPLACE_HREF}) includes askmeatsack.com, showmeatsack.com, and sharemeatsack.com. Each plugin packages its hosted MCP connection and workflow skill. Install the ones you need.

### Codex

\`\`\`sh
${PLUGIN_INSTALL.codex}
\`\`\`

Then choose ${PLUGIN_INSTALL.displayName} from the Meatsack source in Plugins.

### Claude Code

\`\`\`text
${PLUGIN_INSTALL.claude}
\`\`\`

### Cursor

On Teams or Enterprise, open Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo. Use ${MARKETPLACE_HREF}, then install ${PLUGIN_INSTALL.displayName} from Customize.

For a local install:

\`\`\`sh
${PLUGIN_INSTALL.cursor}
\`\`\`

Reload Cursor after linking the plugin.
`;
}

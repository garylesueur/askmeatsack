import { PLUGIN_INSTALL, MARKETPLACE_HREF } from "@/lib/plugin-install";

/** Each plugin includes its hosted MCP connection and workflow skill. */
export function PluginInstall() {
  return (
    <details className="mt-6 rounded-lg border border-border bg-card text-sm">
      <summary className="cursor-pointer rounded-lg px-4 py-3 font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        Install plugin · Codex, Claude Code, Cursor
      </summary>
      <div className="space-y-5 border-t border-border p-4 text-muted-foreground">
        <p>
          Get the MCP connection and skill together. The{" "}
          <a href={MARKETPLACE_HREF} className="underline underline-offset-4 hover:text-foreground">
            Meatsack marketplace
          </a>{" "}
          has askmeatsack.com, showmeatsack.com, and sharemeatsack.com. Install the ones you need.
        </p>
        <div>
          <h3 className="font-semibold text-foreground">Codex</h3>
          <p className="mt-1">
            Add the marketplace, then choose {PLUGIN_INSTALL.displayName} in Plugins.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
            {PLUGIN_INSTALL.codex}
          </pre>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Claude Code</h3>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
            {PLUGIN_INSTALL.claude}
          </pre>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Cursor</h3>
          <p className="mt-1">
            On Teams or Enterprise, open Dashboard → Plugins &amp; MCPs → Add Marketplace → Import
            from Repo. Paste the marketplace URL, then install {PLUGIN_INSTALL.displayName} from
            Customize.
          </p>
          <p className="mt-2">
            For a local install, clone the marketplace and link this plugin into Cursor:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
            {PLUGIN_INSTALL.cursor}
          </pre>
          <p className="mt-1">Reload Cursor after linking the plugin.</p>
        </div>
      </div>
    </details>
  );
}

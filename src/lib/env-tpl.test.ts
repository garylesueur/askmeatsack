import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OP_VAULT_DEFAULT,
  envTemplateFiles,
  itemForLocalDev,
  itemForVercelTarget,
  opTemplateReference,
  secretEnvItems,
  secretKeys,
} from "./secret-envs";

const root = process.cwd();

function envKeys(name: string): string[] {
  const keys: string[] = [];
  for (const line of readFileSync(join(root, name), "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const key = trimmed.split("=", 1)[0];
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}

describe("1Password env templates", () => {
  it("lists the same keys as .env.example in every environment template", () => {
    const example = envKeys(".env.example");
    expect(envKeys(envTemplateFiles.development)).toEqual(example);
    expect(envKeys(envTemplateFiles.preview)).toEqual(example);
    expect(envKeys(envTemplateFiles.production)).toEqual(example);
  });

  it("points each template at its own 1Password item", () => {
    const development = readFileSync(
      join(root, envTemplateFiles.development),
      "utf8",
    );
    expect(development).toContain("PUBLIC_BASE_URL=http://localhost:3000");
    expect(development).toContain(secretEnvItems.development);
    expect(development).toContain(secretEnvItems.preview);
    expect(development).toContain(secretEnvItems.production);
    for (const key of secretKeys) {
      expect(development).toContain(
        `${key}=${opTemplateReference(itemForLocalDev(), key)}`,
      );
    }

    const preview = readFileSync(join(root, envTemplateFiles.preview), "utf8");
    const production = readFileSync(
      join(root, envTemplateFiles.production),
      "utf8",
    );
    expect(production).toContain("PUBLIC_BASE_URL=https://askmeatsack.com");
    for (const key of secretKeys) {
      expect(preview).toContain(
        `${key}=${opTemplateReference(itemForVercelTarget("preview"), key)}`,
      );
      expect(production).toContain(
        `${key}=${opTemplateReference(itemForVercelTarget("production"), key)}`,
      );
    }
  });

  it("pins local scripts to the Development item and only syncs Preview or Production to Vercel", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.env).toContain(envTemplateFiles.development);
    expect(pkg.scripts["dev:op"]).toContain(envTemplateFiles.development);
    expect(pkg.scripts["env:vercel"]).toBe("bash scripts/sync-vercel-env.sh");

    const sync = readFileSync(join(root, "scripts/sync-vercel-env.sh"), "utf8");
    expect(sync).toContain(envTemplateFiles.preview);
    expect(sync).toContain(envTemplateFiles.production);
    expect(sync).not.toContain(envTemplateFiles.development);
    expect(sync).toContain(`OP_VAULT:-$OP_VAULT_DEFAULT`);
    expect(sync).toContain(OP_VAULT_DEFAULT);
    expect(sync).toContain("Development stays in 1Password");
    expect(sync).toContain("op whoami");
    expect(sync).toContain("--value=");
    expect(sync).toContain("--only-new");
  });
});

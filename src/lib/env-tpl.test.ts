import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OP_VAULT_DEFAULT,
  envTemplateFiles,
  itemForVercelTarget,
  opTemplateReference,
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
  it("documents each template key in .env.example and preserves the legacy hosted mapping", () => {
    const example = envKeys(".env.example");
    for (const template of Object.values(envTemplateFiles)) {
      for (const key of envKeys(template)) expect(example).toContain(key);
    }
    expect(envKeys(envTemplateFiles.development)).toContain("ASK_METADATA_SECRET");
    expect(envKeys(envTemplateFiles.preview)).toEqual(envKeys(envTemplateFiles.production));
  });

  it("points each template at its own 1Password item", () => {
    const development = readFileSync(join(root, envTemplateFiles.development), "utf8");
    expect(development).toContain("PUBLIC_BASE_URL=http://localhost:3043");
    expect(development).toContain("LANYARD_URL=http://localhost:3040");
    const references = development.split("\n").filter((line) => line.includes("op://"));
    expect(references.length).toBeGreaterThan(0);
    for (const line of references) {
      expect(line).toContain("/MEATSACK lanyard Development/");
      expect(line).not.toMatch(/Preview|Production/);
    }
    expect(development).toContain("/ASK_R2_SECRET_ACCESS_KEY");
    expect(development).toContain("/ASK_METADATA_SECRET");

    const preview = readFileSync(join(root, envTemplateFiles.preview), "utf8");
    const production = readFileSync(join(root, envTemplateFiles.production), "utf8");
    expect(production).toContain("PUBLIC_BASE_URL=https://ask.imeatsack.com");
    for (const [template, suffix] of [
      [preview, "Preview"],
      [production, "Production"],
    ]) {
      for (const [key, field] of [
        ["LANYARD_URL", "BETTER_AUTH_URL"],
        ["ASK_METADATA_SECRET", "ASK_METADATA_SECRET"],
        ["CLEANROOM_URL", "ASK_CLEANROOM_URL"],
        ["CLEANROOM_SERVICE_CREDENTIAL", "ASK_CLEANROOM_SERVICE_CREDENTIAL"],
        ["CLEANROOM_WEBHOOK_SECRET", "ASK_CLEANROOM_WEBHOOK_SECRET"],
      ]) {
        expect(template).toContain(
          `${key}=${opTemplateReference(`MEATSACK lanyard ${suffix}`, field!)}`,
        );
      }
    }
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
    expect(pkg.scripts.env).toBe("node scripts/environment.mjs write development");
    expect(pkg.scripts["dev:op"]).toContain("environment.mjs run development");
    expect(pkg.scripts["env:op-items"]).toBe("node scripts/environment.mjs check development");
    expect(pkg.scripts["env:vercel"]).toBe("bash scripts/sync-vercel-env.sh");

    const sync = readFileSync(join(root, "scripts/sync-vercel-env.sh"), "utf8");
    expect(sync).toContain(envTemplateFiles.preview);
    expect(sync).toContain(envTemplateFiles.production);
    expect(sync).not.toContain(envTemplateFiles.development);
    expect(sync).toContain(`OP_VAULT:-$OP_VAULT_DEFAULT`);
    expect(sync).toContain(OP_VAULT_DEFAULT);
    expect(sync).toContain("Development stays in 1Password");
    expect(sync).toContain("op-agent");
    expect(sync).not.toContain("--value=");
    expect(sync).toContain("--only-new");
  });
});

describe("hosted credential sync boundary", () => {
  // Multiple bounded child processes can exceed Vitest's default under full-suite load.
  it("uses the scoped reader and stdin without exposing values or selecting a Preview branch", () => {
    const fixture = mkdtempSync(join(tmpdir(), "meatsack-env-sync-"));
    const log = join(fixture, "calls.jsonl");
    const synthetic = "synthetic-credential-not-a-real-secret";
    try {
      mkdirSync(join(fixture, "scripts"));
      mkdirSync(join(fixture, ".vercel"));
      copyFileSync(
        join(root, "scripts/sync-vercel-env.sh"),
        join(fixture, "scripts/sync-vercel-env.sh"),
      );
      for (const target of ["preview", "production"]) {
        writeFileSync(
          join(fixture, `.env.${target}.tpl`),
          `TEST_SECRET=op://\${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/Fixture ${target}/TEST_SECRET\nLANYARD_URL=op://fixture-vault/Fixture ${target}/BETTER_AUTH_URL\nASK_METADATA_SECRET=op://fixture-vault/Fixture ${target}/ASK_METADATA_SECRET\nCLEANROOM_URL=op://fixture-vault/Fixture ${target}/CLEANROOM_URL\nCLEANROOM_SERVICE_CREDENTIAL=op://fixture-vault/Fixture ${target}/CLEANROOM_SERVICE_CREDENTIAL\nCLEANROOM_WEBHOOK_SECRET=op://fixture-vault/Fixture ${target}/CLEANROOM_WEBHOOK_SECRET\nOTHER=ignore\n`,
        );
      }
      const fakeCli = `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const stdin = tool === "vercel" && args[1] === "add" ? fs.readFileSync(0, "utf8") : "";
if (tool === "vercel" && args[1] === "add") { process.stdout.write(stdin); process.stderr.write(stdin); }
fs.appendFileSync(process.env.SYNC_TEST_LOG, JSON.stringify({ tool, args, stdin }) + "\\n");
if (tool === "op-agent" || tool === "op") {
  if (args.includes("read") && !args[args.length - 1].endsWith("/" + process.env.SYNC_TEST_BLANK_FIELD)) process.stdout.write(process.env.SYNC_TEST_VALUE);
} else if (tool === "vercel" && args[1] === "ls" && process.env.SYNC_TEST_EXISTING === "yes") {
  process.stdout.write("TEST_SECRET\\n");
}
`;
      for (const executable of ["op-agent", "op", "vercel"]) {
        writeFileSync(join(fixture, executable), fakeCli, { mode: 0o700 });
      }
      writeFileSync(join(fixture, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
      const env = {
        ...process.env,
        PATH: `${fixture}:${process.env.PATH}`,
        OP_AGENT_BIN: join(fixture, "op-agent"),
        OP_VAULT: "fixture-vault",
        VERCEL_SCOPE: "fixture-scope",
        SYNC_TEST_LOG: log,
        SYNC_TEST_VALUE: synthetic,
      };
      for (const target of ["preview", "production"]) {
        writeFileSync(log, "");
        const result = spawnSync(
          "bash",
          ["scripts/sync-vercel-env.sh", target, "--var", "TEST_SECRET"],
          {
            cwd: fixture,
            env,
            encoding: "utf8",
            timeout: 10_000,
          },
        );
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout + result.stderr).not.toContain(synthetic);
        const calls = readFileSync(log, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line)) as {
          tool: string;
          args: string[];
          stdin: string;
        }[];
        expect(calls.some((call) => call.tool === "op")).toBe(false);
        const reads = calls.filter((call) => call.tool === "op-agent" && call.args[1] === "read");
        expect(reads.length).toBeGreaterThan(0);
        expect(
          reads.some((call) => call.args[2] === `op://fixture-vault/Fixture ${target}/TEST_SECRET`),
        ).toBe(true);
        expect(
          reads.every(
            (call) =>
              !call.args[2]?.includes(
                `Fixture ${target === "preview" ? "production" : "preview"}/`,
              ),
          ),
        ).toBe(true);
        expect(
          reads.every(
            (call) => call.args[0] === "meatsack" && !call.args[2]?.includes("Development"),
          ),
        ).toBe(true);
        const additions = calls.filter((call) => call.tool === "vercel" && call.args[1] === "add");
        expect(additions.length).toBeGreaterThan(0);
        for (const call of additions) {
          expect(call.args).not.toContain(synthetic);
          expect(call.args.some((arg) => arg.startsWith("--value"))).toBe(false);
          expect(call.args[3]).toBe(target);
          expect(call.args).toContain("--sensitive");
          expect(call.args).toContain("--scope=fixture-scope");
          expect(call.args).toContain("--yes");
          expect(call.args).toContain("--non-interactive");
          if (target === "preview") expect(call.args[4]).toBe("");
          expect(call.stdin).toBe(synthetic);
        }
        expect(additions.map((call) => call.args[2])).toEqual(["TEST_SECRET"]);
        writeFileSync(log, "");
        const skipped = spawnSync(
          "bash",
          ["scripts/sync-vercel-env.sh", "--env", target, "--var", "TEST_SECRET", "--only-new"],
          {
            cwd: fixture,
            env: { ...env, SYNC_TEST_EXISTING: "yes" },
            encoding: "utf8",
            timeout: 10_000,
          },
        );
        expect(skipped.status, skipped.stderr).toBe(0);
        expect(readFileSync(log, "utf8")).not.toContain('"add"');
      }
      writeFileSync(log, "");
      const refused = spawnSync("bash", ["scripts/sync-vercel-env.sh", "preview"], {
        cwd: fixture,
        env: { ...env, SYNC_TEST_BLANK_FIELD: "BETTER_AUTH_URL" },
        encoding: "utf8",
        timeout: 10_000,
      });
      expect(refused.status).not.toBe(0);
      expect(refused.stderr).toContain("required");
      const refusedCalls = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)) as {
        tool: string;
        args: string[];
      }[];
      expect(
        refusedCalls.some(
          (call) => call.tool === "vercel" && ["add", "rm"].includes(call.args[1]!),
        ),
      ).toBe(false);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 15_000);
});

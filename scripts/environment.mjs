import { spawnSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { DEVELOPMENT_ITEM, OP_VAULT, developmentValues } from "./environment-config.mjs";

const [mode, target = "development", ...command] = process.argv.slice(2);
if (!["run", "write", "check"].includes(mode) || target !== "development")
  throw new Error(
    "Usage: environment.mjs run|write|check development. Hosted secrets stay on their deployments.",
  );
const root = resolve(import.meta.dirname, "..");
const loaded = spawnSync(
  resolve(homedir(), ".local/bin/op-agent"),
  [
    process.env.OP_AGENT_PROFILE ?? "meatsack",
    "item",
    "get",
    DEVELOPMENT_ITEM,
    "--vault",
    process.env.OP_VAULT ?? OP_VAULT,
    "--format",
    "json",
    "--reveal",
  ],
  { encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
if (loaded.status !== 0)
  throw new Error(`Cannot read ${DEVELOPMENT_ITEM} through the scoped service account.`);
const values = developmentValues(JSON.parse(loaded.stdout));
if (mode === "check") {
  console.log(`${DEVELOPMENT_ITEM}: Ask Development fields are filled.`);
} else if (mode === "write") {
  const ignored = spawnSync("git", ["check-ignore", "--quiet", ".env.local"], { cwd: root });
  if (ignored.status !== 0)
    throw new Error("Refusing to write a local secrets file that is not gitignored.");
  const path = resolve(root, ".env.local");
  writeFileSync(
    path,
    Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  chmodSync(path, 0o600);
  console.log(`Loaded Ask Development into .env.local (permissions 0600).`);
} else {
  if (!command.length) throw new Error("Supply the Development command to run.");
  const child = spawnSync(command[0], command.slice(1), {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...values },
  });
  process.exit(child.status ?? 1);
}

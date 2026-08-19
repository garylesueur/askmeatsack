#!/usr/bin/env node
/**
 * Inside `src/lib`, a relative import means "same layer" and reaching for `@/`
 * means crossing one. Allowing the alias in both places hides a boundary that
 * does not exist.
 *
 * This is a script rather than a lint rule because oxlint's
 * `no-restricted-imports` matches exact module names, not globs — and listing
 * every module under `@/lib` by hand would go stale the first time someone adds
 * a file. Fifteen lines that cannot go stale beat a list that can.
 *
 * Decision: `import-layer-signal` in .engineering/conventions.yaml.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/lib";
const ALIAS = /^\s*(?:import|export)[\s\S]*?from\s+["'](@\/[^"']+)["']/gm;

function filesUnder(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

const offences = [];
for (const file of filesUnder(ROOT)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(ALIAS)) {
    const line = source.slice(0, match.index).split("\n").length;
    offences.push(`${file}:${line}  imports ${match[1]}`);
  }
}

if (offences.length > 0) {
  console.error(`\n${ROOT} must import siblings relatively. The alias is for crossing layers.\n`);
  for (const offence of offences) console.error(`  ${offence}`);
  console.error(`\n${offences.length} import(s) to fix.\n`);
  process.exit(1);
}

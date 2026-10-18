import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// public/plugin-icon.png owns the artwork; these files are generated exports.
const root = fileURLToPath(new URL("../", import.meta.url));
const source = readFileSync(`${root}public/plugin-icon.png`);
const check = process.argv.includes("--check");

async function png(size) {
  return sharp(source).resize(size, size, { fit: "contain" }).ensureAlpha().png().toBuffer();
}

async function favicon() {
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map(png));
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  for (const [index, size] of sizes.entries()) {
    const entry = 6 + index * 16;
    directory.writeUInt8(size, entry);
    directory.writeUInt8(size, entry + 1);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(images[index].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  }
  return Buffer.concat([directory, ...images]);
}

const exports = [
  ["src/app/favicon.ico", await favicon()],
  ["src/app/icon.png", await png(32)],
  ["src/app/apple-icon.png", await png(180)],
];
for (const [path, image] of exports) {
  if (check) {
    let current;
    try {
      current = readFileSync(`${root}${path}`);
    } catch {
      // Report missing and stale exports through the same regeneration command.
    }
    if (!current?.equals(image)) {
      throw new Error(`${path} is out of date. Run pnpm sync:icons.`);
    }
  } else {
    writeFileSync(`${root}${path}`, image);
  }
}
console.log(check ? "Site icons match their source." : "Site icons regenerated.");

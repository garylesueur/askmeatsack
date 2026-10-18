import { describe, expect, it } from "vitest";
import {
  OP_VAULT_DEFAULT,
  OP_VAULT_NAME,
  envTemplateFiles,
  itemForLocalDev,
  itemForVercelTarget,
  opSecretReference,
  opTemplateReference,
  parseVercelSecretTarget,
  secretEnvItems,
  secretKeys,
} from "./secret-envs";

describe("secret environments", () => {
  it("uses the shared Development item and existing hosted item mappings", () => {
    expect(OP_VAULT_NAME).toBe("Agents");
    expect(OP_VAULT_DEFAULT).toBe("mep374l3cpdtzwibf5fswsimbi");
    expect(secretEnvItems).toEqual({
      development: "MEATSACK lanyard Development",
      preview: "ucxrz4yvhmmrajqqjdxokdmzju",
      production: "fgps4a7gwmzfbl7vrn2lk6oela",
    });
    expect(envTemplateFiles).toEqual({
      development: ".env.development.tpl",
      preview: ".env.preview.tpl",
      production: ".env.production.tpl",
    });
  });

  it("pins local work to the Development item", () => {
    expect(itemForLocalDev()).toBe("MEATSACK lanyard Development");
  });

  it("maps Vercel targets to their own items and refuses Development", () => {
    expect(itemForVercelTarget("preview")).toBe("ucxrz4yvhmmrajqqjdxokdmzju");
    expect(itemForVercelTarget("production")).toBe("fgps4a7gwmzfbl7vrn2lk6oela");
    expect(parseVercelSecretTarget("preview")).toBe("preview");
    expect(parseVercelSecretTarget("production")).toBe("production");
    expect(() => parseVercelSecretTarget("development")).toThrow(/Development stays in 1Password/);
  });

  it("builds op:// references without embedding values", () => {
    expect(opSecretReference(OP_VAULT_DEFAULT, "ucxrz4yvhmmrajqqjdxokdmzju", "AGENT_API_KEY")).toBe(
      "op://mep374l3cpdtzwibf5fswsimbi/ucxrz4yvhmmrajqqjdxokdmzju/AGENT_API_KEY",
    );
    expect(opTemplateReference(secretEnvItems.development, "AGENT_API_KEY")).toBe(
      "op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/MEATSACK lanyard Development/AGENT_API_KEY",
    );
    expect(secretKeys).toContain("AGENT_API_KEY");
    expect(secretKeys).toContain("R2_SECRET_ACCESS_KEY");
    expect(secretKeys).toContain("R2_PUBLIC_BASE_URL");
    expect(secretKeys).not.toContain("BLOB_READ_WRITE_TOKEN");
    expect(secretKeys).not.toContain("PUBLIC_BASE_URL");
  });
});

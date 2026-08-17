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
  it("uses three items in one vault", () => {
    expect(OP_VAULT_NAME).toBe("Agents");
    expect(OP_VAULT_DEFAULT).toBe("mep374l3cpdtzwibf5fswsimbi");
    expect(secretEnvItems).toEqual({
      development: "askmeatsack.com Development",
      preview: "askmeatsack.com Preview",
      production: "askmeatsack.com Production",
    });
    expect(envTemplateFiles).toEqual({
      development: ".env.development.tpl",
      preview: ".env.preview.tpl",
      production: ".env.production.tpl",
    });
  });

  it("pins local work to the Development item", () => {
    expect(itemForLocalDev()).toBe("askmeatsack.com Development");
  });

  it("maps Vercel targets to their own items and refuses Development", () => {
    expect(itemForVercelTarget("preview")).toBe("askmeatsack.com Preview");
    expect(itemForVercelTarget("production")).toBe(
      "askmeatsack.com Production",
    );
    expect(parseVercelSecretTarget("preview")).toBe("preview");
    expect(parseVercelSecretTarget("production")).toBe("production");
    expect(() => parseVercelSecretTarget("development")).toThrow(
      /Development stays in 1Password/,
    );
  });

  it("builds op:// references without embedding values", () => {
    expect(
      opSecretReference(
        OP_VAULT_DEFAULT,
        "askmeatsack.com Preview",
        "AGENT_API_KEY",
      ),
    ).toBe(
      "op://mep374l3cpdtzwibf5fswsimbi/askmeatsack.com Preview/AGENT_API_KEY",
    );
    expect(
      opTemplateReference(secretEnvItems.development, "AGENT_API_KEY"),
    ).toBe(
      "op://${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}/askmeatsack.com Development/AGENT_API_KEY",
    );
    expect(secretKeys).toContain("AGENT_API_KEY");
    expect(secretKeys).toContain("R2_SECRET_ACCESS_KEY");
    expect(secretKeys).toContain("R2_PUBLIC_BASE_URL");
    expect(secretKeys).not.toContain("BLOB_READ_WRITE_TOKEN");
    expect(secretKeys).not.toContain("PUBLIC_BASE_URL");
  });
});

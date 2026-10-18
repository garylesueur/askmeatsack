import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_FIELDS,
  DEVELOPMENT_ITEM,
  developmentValues,
} from "../../scripts/environment-config.mjs";
describe("Ask Development environment", () => {
  it("maps only Ask's storage authority from the existing shared item", () => {
    const fields = Object.values(DEVELOPMENT_FIELDS).map((label) => ({
      label,
      value: `test-${label}`,
    }));
    const values = developmentValues({
      fields: [
        ...fields,
        { label: "R2_SECRET_ACCESS_KEY", value: "share-secret" },
        { label: "RESEND_API_KEY", value: "email-secret" },
        { label: "KV_REST_API_TOKEN", value: "hosted-redis" },
      ],
    });
    expect(DEVELOPMENT_ITEM).toBe("MEATSACK lanyard Development");
    expect(values.R2_SECRET_ACCESS_KEY).toBe("test-ASK_R2_SECRET_ACCESS_KEY");
    expect(values.CLEANROOM_WEBHOOK_SECRET).toBe("test-ASK_CLEANROOM_WEBHOOK_SECRET");
    expect(values.KV_REST_API_TOKEN).toBe("");
    expect(values.LANYARD_URL).toBe("http://localhost:3040");
    expect(values).not.toHaveProperty("RESEND_API_KEY");
    expect(Object.values(values)).not.toContain("share-secret");
  });
  it("reports required field names without disclosing values", () => {
    expect(() =>
      developmentValues({
        fields: [{ label: "ASK_R2_SECRET_ACCESS_KEY", value: "private-secret" }],
      }),
    ).toThrow("ASK_METADATA_SECRET");
    try {
      developmentValues({
        fields: [{ label: "ASK_R2_SECRET_ACCESS_KEY", value: "private-secret" }],
      });
    } catch (error) {
      expect(String(error)).not.toContain("private-secret");
    }
  });
  it.each(["preview", "production"])(
    "refuses a local %s command before reading credentials",
    (environment) => {
      const result = spawnSync(
        process.execPath,
        ["scripts/environment.mjs", "run", environment, "invalid-command"],
        { cwd: import.meta.dirname + "/../..", encoding: "utf8" },
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Hosted secrets stay on their deployments");
      expect(result.stdout).toBe("");
    },
  );
});

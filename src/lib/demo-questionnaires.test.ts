import { describe, expect, it } from "vitest";
import { createSessionSchema } from "./schema";
import { demoQuestionnaires, pickDemoQuestionnaire } from "./demo-questionnaires";
import { cursorInstallHref, cursorInstallPageHref } from "./cursor-install";

describe("homepage demo packs", () => {
  it("every pack is a usable create body", () => {
    for (const pack of demoQuestionnaires) {
      const parsed = createSessionSchema.safeParse(pack);
      expect(parsed.success).toBe(true);
    }
  });

  it("picks a pack from the list", () => {
    const picked = pickDemoQuestionnaire(() => 0);
    expect(picked.title).toBe(demoQuestionnaires[0]?.title);
  });

  it("builds an Open in Cursor install link", () => {
    const href = cursorInstallHref("https://askmeatsack.com/mcp");
    expect(href.startsWith("cursor://anysphere.cursor-deeplink/mcp/install?")).toBe(true);
    expect(href).toContain("name=askmeatsack.com");
    expect(href).toContain("config=");
  });

  it("builds Cursor's web install page for the landing button", () => {
    const href = cursorInstallPageHref("https://askmeatsack.com/mcp");
    expect(href.startsWith("https://cursor.com/en/install-mcp?")).toBe(true);
    expect(href).toContain("name=askmeatsack.com");
    expect(href).toContain("config=");
  });
});

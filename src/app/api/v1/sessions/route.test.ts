import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySessionStore, type SessionStore } from "@/lib/session-store";
import { POST } from "./route";

const LANYARD = "https://lanyard.test";
const OPERATOR_KEY = "test-agent-key-0000000000000000000000";

const state = globalThis as typeof globalThis & { askmeatsackStore?: SessionStore };
let previousStore: SessionStore | undefined;
let store: SessionStore;
let lanyard: ReturnType<typeof vi.fn>;
let caller = 0;

beforeEach(() => {
  previousStore = state.askmeatsackStore;
  store = createMemorySessionStore();
  state.askmeatsackStore = store;
  vi.stubEnv("PUBLIC_BASE_URL", "https://ask.imeatsack.com");
  vi.stubEnv("AGENT_API_KEY", OPERATOR_KEY);
  lanyard = vi.fn();
  vi.stubGlobal("fetch", lanyard);
});
afterEach(() => {
  state.askmeatsackStore = previousStore;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function create(bearer?: string): Promise<Response> {
  caller += 1;
  return POST(
    new Request("https://ask.imeatsack.com/api/v1/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // A fresh address per call keeps the create rate limit out of the way.
        "x-forwarded-for": `203.0.113.${caller}`,
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({ title: "Quick check", questions: [{ id: "q", prompt: "Ship it?" }] }),
    }),
  );
}

async function storedAccount(response: Response): Promise<string | undefined> {
  const { sessionId } = (await response.json()) as { sessionId: string };
  const session = await store.getById(sessionId);
  if (!session) throw new Error("not stored");
  return session.account;
}

const lanyardSays = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

describe("Create without lanyard configured behaves as before", () => {
  it("ignores any bearer and never calls out", async () => {
    vi.stubEnv("LANYARD_URL", "");
    for (const bearer of [undefined, "some-lanyard-token", OPERATOR_KEY]) {
      const response = await create(bearer);
      expect(response.status).toBe(201);
      expect(await storedAccount(response)).toBeUndefined();
    }
    expect(lanyard).not.toHaveBeenCalled();
  });
});

describe("Create with LANYARD_URL set", () => {
  beforeEach(() => {
    vi.stubEnv("LANYARD_URL", LANYARD);
  });

  it("anonymous create is unchanged even when lanyard is down", async () => {
    lanyard.mockRejectedValue(new TypeError("fetch failed"));
    const response = await create();
    expect(response.status).toBe(201);
    expect(await storedAccount(response)).toBeUndefined();
    expect(lanyard).not.toHaveBeenCalled();
  });

  it("the operator key keeps working and is never sent to lanyard", async () => {
    const response = await create(OPERATOR_KEY);
    expect(response.status).toBe(201);
    expect(await storedAccount(response)).toBeUndefined();
    expect(lanyard).not.toHaveBeenCalled();
  });

  it("an accepted token records its account on the new questionnaire", async () => {
    lanyard.mockResolvedValue(lanyardSays(200, { account: "acct_accepted" }));
    const response = await create("token-accepted");
    expect(response.status).toBe(201);
    expect(await storedAccount(response)).toBe("acct_accepted");
    const [url, init] = lanyard.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${LANYARD}/api/v1/verify`);
    expect(JSON.parse(String(init.body))).toEqual({
      token: "token-accepted",
      product: "askmeatsack",
    });
  });

  it("a refused token is unauthorised and creates nothing", async () => {
    lanyard.mockResolvedValue(lanyardSays(401));
    const response = await create("token-refused");
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("unauthorized");
    expect(body.error.message).toContain(`${LANYARD}/sign-in?product=askmeatsack`);
  });

  it("a token verified before keeps working through a lanyard outage", async () => {
    lanyard.mockResolvedValueOnce(lanyardSays(200, { account: "acct_grace" }));
    expect((await create("token-grace")).status).toBe(201);

    lanyard.mockRejectedValue(new TypeError("fetch failed"));
    const during = await create("token-grace");
    expect(during.status).toBe(201);
    expect(await storedAccount(during)).toBe("acct_grace");

    // A token never seen before gets no grace.
    expect((await create("token-never-seen")).status).toBe(401);
  });
});

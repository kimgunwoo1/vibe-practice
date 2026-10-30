import { beforeEach, describe, expect, it, vi } from "vitest";

// Claude와 MongoDB를 부르지 않도록 Mastra 메모리와 요청 제한을 가짜로 바꾼다
const OWNER_THREAD = "11111111-1111-4111-8111-111111111111";
const memory = {
  getThreadById: vi.fn(),
  listThreads: vi.fn(),
  recall: vi.fn(),
  updateThread: vi.fn(),
  deleteThread: vi.fn(),
};
const agent = { stream: vi.fn() };
vi.mock("@/mastra", () => ({ getCounselor: async () => ({ agent, memory }) }));

// agent.stream()이 돌려주는 fullStream 흉내
function fakeOutput(chunks: object[]) {
  return {
    fullStream: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
  };
}
vi.mock("@/server/middleware/rate-limit", async (orig) => ({
  ...(await orig<object>()),
  rateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

const { app } = await import("@/server/app");

process.env.SESSION_SECRET = "test-secret";

// 첫 요청에서 받은 익명 ID 쿠키를 다음 요청에 그대로 보낸다
async function cookieFor() {
  const res = await app.request("/api/conversations");
  return res.headers.get("set-cookie")!.split(";")[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  memory.listThreads.mockResolvedValue({ threads: [] });
});

describe("API", () => {
  it("/api/health는 쿠키 없이 답한다", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("처음 방문하면 HttpOnly 익명 ID 쿠키를 발급한다", async () => {
    const res = await app.request("/api/conversations");
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^anon_id=.+HttpOnly/);
  });

  it("고정한 대화를 목록 맨 위로 올린다", async () => {
    memory.listThreads.mockResolvedValue({
      threads: [
        { id: "a", title: "최근", metadata: {}, updatedAt: "2026-10-02" },
        { id: "b", title: "고정", metadata: { pinned: true }, updatedAt: "2026-10-01" },
      ],
    });
    const res = await app.request("/api/conversations");
    const { conversations } = await res.json();
    expect(conversations.map((c: { id: string }) => c.id)).toEqual(["b", "a"]);
  });

  it("남의 대화는 404로 막는다", async () => {
    memory.getThreadById.mockResolvedValue({ id: OWNER_THREAD, resourceId: "someone-else" });
    const cookie = await cookieFor();
    for (const [method, path] of [
      ["GET", `/api/conversations/${OWNER_THREAD}/messages`],
      ["DELETE", `/api/conversations/${OWNER_THREAD}`],
    ]) {
      const res = await app.request(path, { method, headers: { cookie } });
      expect(res.status).toBe(404);
    }
    expect(memory.deleteThread).not.toHaveBeenCalled();
  });

  it("빈 메시지나 너무 긴 메시지는 400으로 거절한다", async () => {
    const cookie = await cookieFor();
    for (const message of ["   ", "가".repeat(2001)]) {
      const res = await app.request("/api/chat", {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("INVALID_INPUT");
    }
  });

  it("답변 글자만 스트리밍하고 대화 ID를 헤더로 알려 준다", async () => {
    agent.stream.mockResolvedValue(
      fakeOutput([
        { type: "tool-call", payload: {} },
        { type: "text-delta", payload: { text: "주민센터" } },
        { type: "text-delta", payload: { text: "에서 신청해요." } },
      ]),
    );
    const cookie = await cookieFor();
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "어디서 신청하나요?" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-conversation-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await res.text()).toBe("주민센터에서 신청해요.");
  });

  it("첫 글자 전에 모델 오류가 나면 502 JSON으로 답한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    agent.stream.mockResolvedValue(
      fakeOutput([{ type: "error", payload: { error: new Error("domains are not accessible") } }]),
    );
    const cookie = await cookieFor();
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "안녕하세요" }),
    });
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("UPSTREAM");
  });

  it("없는 주소는 한국어 JSON 오류로 답한다", async () => {
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toContain("찾을 수 없습니다");
  });
});

describe("clientIp", () => {
  it("X-Forwarded-For의 첫 번째 IP를 쓴다", async () => {
    const { clientIp } = await import("@/server/middleware/rate-limit");
    expect(clientIp("1.2.3.4, 10.0.0.1")).toBe("1.2.3.4");
    expect(clientIp(undefined)).toBe("unknown");
  });
});

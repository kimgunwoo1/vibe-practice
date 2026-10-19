import { Hono } from "hono";
import type { AppEnv } from "./env";
import { ApiError } from "./errors";
import { anonId } from "./middleware/anon-id";
import { chat } from "./routes/chat";
import { conversations } from "./routes/conversations";

export const app = new Hono<AppEnv>().basePath("/api");

// Cloud Run 상태 확인용. 쿠키나 DB 없이 바로 답한다.
app.get("/health", (c) => c.json({ ok: true }));

app.use("/chat/*", anonId);
app.use("/conversations/*", anonId);
app.route("/chat", chat);
app.route("/conversations", conversations);

app.notFound((c) =>
  c.json({ error: { code: "NOT_FOUND", message: "요청한 주소를 찾을 수 없습니다." } }, 404),
);

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }
  // 메시지 본문이 로그에 남지 않도록 오류 객체만 기록한다
  console.error("[api] unhandled error", err);
  return c.json(
    { error: { code: "INTERNAL", message: "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요." } },
    500,
  );
});

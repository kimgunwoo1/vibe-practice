import { createMiddleware } from "hono/factory";
import { connectDB } from "@/lib/db";
import { RateLimit } from "@/models/RateLimit";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";

// Cloud Run은 인스턴스가 여러 개일 수 있어 메모리 카운터 대신 MongoDB에 센다.
// IP는 기관 사무실처럼 여러 사람이 함께 쓸 수 있어 익명 ID보다 넉넉하게 둔다.
const LIMITS = [
  { window: "min", ms: 60_000, anon: 10, ip: 30 },
  { window: "day", ms: 86_400_000, anon: 100, ip: 300 },
] as const;

export function clientIp(forwardedFor: string | undefined) {
  // Cloud Run은 X-Forwarded-For 맨 앞에 실제 클라이언트 IP를 넣는다
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export const rateLimit = createMiddleware<AppEnv>(async (c, next) => {
  await connectDB();
  const now = Date.now();
  const subjects = [
    { kind: "anon", id: c.get("anonId") },
    { kind: "ip", id: clientIp(c.req.header("x-forwarded-for")) },
  ] as const;

  for (const limit of LIMITS) {
    const slot = Math.floor(now / limit.ms);
    for (const subject of subjects) {
      const doc = await RateLimit.findOneAndUpdate(
        { key: `${limit.window}:${subject.kind}:${subject.id}:${slot}` },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((slot + 1) * limit.ms) } },
        { upsert: true, returnDocument: "after" },
      );
      if (doc && doc.count > limit[subject.kind]) {
        throw new ApiError(
          429,
          "RATE_LIMITED",
          limit.window === "min"
            ? "질문이 너무 빠르게 이어지고 있어요. 1분 뒤에 다시 시도해 주세요."
            : "오늘 질문할 수 있는 횟수를 모두 썼어요. 내일 다시 이용해 주세요.",
        );
      }
    }
  }
  await next();
});

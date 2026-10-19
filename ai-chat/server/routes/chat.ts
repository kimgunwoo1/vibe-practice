import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getCounselor } from "@/mastra";
import { maskPersonalInfo } from "@/lib/mask";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";
import { rateLimit } from "../middleware/rate-limit";
import { getOwnedThread } from "./conversations";

export const MAX_MESSAGE_LENGTH = 2000;

const body = z.object({
  // 없으면 새 대화를 시작한다
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export const chat = new Hono<AppEnv>().post(
  "/",
  zValidator("json", body, (result) => {
    if (!result.success) {
      throw new ApiError(400, "INVALID_INPUT", "메시지는 1자 이상 2,000자 이하로 입력해 주세요.");
    }
  }),
  rateLimit,
  async (c) => {
    const { conversationId, message } = c.req.valid("json");
    const anonId = c.get("anonId");
    const { agent, memory } = await getCounselor();

    if (conversationId) await getOwnedThread(memory, conversationId, anonId);
    const threadId = conversationId ?? crypto.randomUUID();

    const output = await agent.stream(maskPersonalInfo(message), {
      memory: { thread: { id: threadId }, resource: anonId },
      // 사용자가 중지를 누르거나 연결이 끊기면 Claude 요청도 멈춘다
      abortSignal: c.req.raw.signal,
    });

    // 응답 본문은 답변 글자만 그대로 흘려보낸다.
    // 도중에 오류가 나면 스트림을 오류로 끝내 클라이언트가 알 수 있게 한다.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of output.fullStream) {
            if (chunk.type === "text-delta") {
              controller.enqueue(encoder.encode(chunk.payload.text));
            } else if (chunk.type === "error") {
              throw chunk.payload.error;
            }
          }
          controller.close();
        } catch (err) {
          if (!c.req.raw.signal.aborted) console.error("[chat] stream error", err);
          controller.error(err);
        }
      },
    });

    c.header("X-Conversation-Id", threadId);
    c.header("Cache-Control", "no-cache, no-transform");
    c.header("Content-Type", "text/plain; charset=utf-8");
    return c.body(stream);
  },
);

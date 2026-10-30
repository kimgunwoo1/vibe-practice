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

    // 답변 글자만 뽑는다. 오류 조각은 예외로 바꾼다.
    async function* texts() {
      for await (const chunk of output.fullStream) {
        if (chunk.type === "text-delta") yield chunk.payload.text;
        else if (chunk.type === "error") throw chunk.payload.error;
      }
    }
    const it = texts();

    // 첫 글자가 나올 때까지 기다린 뒤에 응답을 시작한다.
    // 그 전에 실패하면(Claude API 거절 등) 빈 스트림을 끊는 대신 한국어 오류 JSON으로 답한다.
    // 빈 스트림을 끊으면 Cloud Run이 503 "Service Unavailable"로 바꿔 버린다.
    let first: IteratorResult<string>;
    try {
      first = await it.next();
    } catch (err) {
      if (c.req.raw.signal.aborted) throw err;
      console.error("[chat] model error before first text", err);
      throw new ApiError(502, "UPSTREAM", "답변을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
    }

    // 첫 글자 뒤의 오류는 스트림을 오류로 끝내 클라이언트가 알 수 있게 한다.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (!first.done) {
            controller.enqueue(encoder.encode(first.value));
            for await (const text of { [Symbol.asyncIterator]: () => it }) {
              controller.enqueue(encoder.encode(text));
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

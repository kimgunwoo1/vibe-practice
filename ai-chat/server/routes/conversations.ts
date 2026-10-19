import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { MastraDBMessage } from "@mastra/core/agent";
import { getCounselor } from "@/mastra";
import type { AppEnv } from "../env";
import { ApiError, notFound } from "../errors";

type CounselorMemory = Awaited<ReturnType<typeof getCounselor>>["memory"];

// 남의 대화는 존재 여부도 알리지 않도록 똑같이 404로 답한다
export async function getOwnedThread(memory: CounselorMemory, threadId: string, anonId: string) {
  const thread = await memory.getThreadById({ threadId });
  if (!thread || thread.resourceId !== anonId) throw notFound();
  return thread;
}

function textOf(message: MastraDBMessage) {
  return message.content.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
}

const idParam = z.object({ id: z.string().uuid() });
const patchBody = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.pinned !== undefined);

const invalid = () => new ApiError(400, "INVALID_INPUT", "요청 형식이 올바르지 않습니다.");
const onInvalid = (result: { success: boolean }) => {
  if (!result.success) throw invalid();
};

export const conversations = new Hono<AppEnv>()
  .get("/", async (c) => {
    const { memory } = await getCounselor();
    const { threads } = await memory.listThreads({
      filter: { resourceId: c.get("anonId") },
      orderBy: { field: "updatedAt", direction: "DESC" },
      perPage: 100,
    });
    const items = threads.map((t) => ({
      id: t.id,
      title: t.title || "새 대화",
      pinned: t.metadata?.pinned === true,
      updatedAt: t.updatedAt,
    }));
    // 고정한 대화를 위로 (sort는 안정 정렬이라 최신순은 그대로 유지된다)
    items.sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return c.json({ conversations: items });
  })
  .get("/:id/messages", zValidator("param", idParam, onInvalid), async (c) => {
    const { id } = c.req.valid("param");
    const { memory } = await getCounselor();
    await getOwnedThread(memory, id, c.get("anonId"));
    const { messages } = await memory.recall({ threadId: id, perPage: false });
    return c.json({
      messages: messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ id: m.id, role: m.role, text: textOf(m) }))
        .filter((m) => m.text),
    });
  })
  .patch(
    "/:id",
    zValidator("param", idParam, onInvalid),
    zValidator("json", patchBody, onInvalid),
    async (c) => {
      const { id } = c.req.valid("param");
      const { title, pinned } = c.req.valid("json");
      const { memory } = await getCounselor();
      const thread = await getOwnedThread(memory, id, c.get("anonId"));
      await memory.updateThread({
        id,
        title: title ?? thread.title ?? "새 대화",
        metadata: {
          ...thread.metadata,
          ...(pinned !== undefined && { pinned }),
          // 직접 바꾼 제목을 자동 제목 생성이 덮어쓰지 않게 한다
          ...(title !== undefined && { titlePinned: true }),
        },
      });
      return c.json({ ok: true });
    },
  )
  .delete("/:id", zValidator("param", idParam, onInvalid), async (c) => {
    const { id } = c.req.valid("param");
    const { memory } = await getCounselor();
    await getOwnedThread(memory, id, c.get("anonId"));
    await memory.deleteThread(id);
    return c.json({ ok: true });
  });

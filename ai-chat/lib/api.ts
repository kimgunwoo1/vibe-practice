// 브라우저에서 /api를 부르는 함수들 (클라이언트 전용)

export type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export class ClientError extends Error {}

async function errorMessage(res: Response) {
  try {
    const data = await res.json();
    if (typeof data?.error?.message === "string") return data.error.message as string;
  } catch {}
  return "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ClientError("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
  }
  if (!res.ok) throw new ClientError(await errorMessage(res));
  return res.json() as Promise<T>;
}

export const api = {
  listConversations: () =>
    request<{ conversations: Conversation[] }>("/conversations").then((d) => d.conversations),

  getMessages: (id: string) =>
    request<{ messages: ChatMessage[] }>(`/conversations/${id}/messages`).then((d) => d.messages),

  updateConversation: (id: string, patch: { title?: string; pinned?: boolean }) =>
    request(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteConversation: (id: string) => request(`/conversations/${id}`, { method: "DELETE" }),

  // 답변을 글자 조각으로 흘려받는다. 새 대화면 서버가 만든 ID를 onConversationId로 알려 준다.
  async streamChat(opts: {
    conversationId: string | null;
    message: string;
    signal: AbortSignal;
    onConversationId: (id: string) => void;
    onText: (fullText: string) => void;
  }) {
    let res: Response;
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: opts.conversationId ?? undefined,
          message: opts.message,
        }),
        signal: opts.signal,
      });
    } catch (err) {
      if (opts.signal.aborted) throw err;
      throw new ClientError("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
    }
    if (!res.ok || !res.body) throw new ClientError(await errorMessage(res));

    const id = res.headers.get("X-Conversation-Id");
    if (id) opts.onConversationId(id);

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let full = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += value;
        opts.onText(full);
      }
    } catch (err) {
      if (opts.signal.aborted) throw err;
      throw new ClientError("답변을 받는 중에 연결이 끊겼어요. 다시 시도해 주세요.");
    }
    return full;
  },
};

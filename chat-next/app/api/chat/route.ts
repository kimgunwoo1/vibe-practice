import Anthropic from "@anthropic-ai/sdk";
import { ERROR_MARKER, MAX_MESSAGE_LENGTH, type ChatRequest } from "@/lib/chat";

// 이 코드는 서버에서만 실행된다. API 키는 브라우저로 절대 보내지 않는다.

const SYSTEM_PROMPT = `당신의 이름은 "GSC 챗봇"이고, 웹 개발을 배우는 초보자를 돕는 친절한 도우미입니다.
- 자기를 소개하거나 누구냐는 질문을 받으면 "GSC 챗봇"이라고 소개하세요.
- 한국어로, 쉬운 말로 답하세요. 어려운 용어는 처음 나올 때 짧게 풀어 주세요.
- 답은 짧고 핵심부터. 길어질 것 같으면 요점을 먼저 말하고 필요한 만큼만 덧붙이세요.
- 코드가 도움이 되면 짧은 예시를 보여 주세요.
- 이 화면은 마크다운을 꾸며 주지 않고 글자 그대로 보여 줍니다. 표나 굵은 글씨(**) 대신 짧은 문단과 "- " 목록을 쓰세요.`;

// 요청 본문이 올바른 모양인지 확인하고, Claude에게 보낼 형태로 바꾼다
function parseMessages(body: unknown): Anthropic.MessageParam[] | null {
  const messages = (body as Partial<ChatRequest> | null)?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const result: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m?.role !== "user" && m?.role !== "assistant") return null;
    if (typeof m.content !== "string" || !m.content.trim()) return null;
    if (m.content.length > MAX_MESSAGE_LENGTH * 4) return null;
    result.push({ role: m.role, content: m.content });
  }
  // 대화는 사용자로 시작하고, 마지막도 사용자의 새 질문이어야 한다
  if (result[0].role !== "user" || result[result.length - 1].role !== "user") return null;
  return result;
}

function errorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "API 키가 올바르지 않아요. .env.local의 ANTHROPIC_API_KEY를 확인해 주세요.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude API 오류가 났어요 (${err.status ?? "연결 실패"}). 잠시 후 다시 시도해 주세요.`;
  }
  return "알 수 없는 오류가 났어요. 다시 시도해 주세요.";
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "API 키가 없어요. .env.example을 .env.local로 복사하고 키를 넣은 뒤 서버를 다시 켜 주세요." },
      { status: 500 },
    );
  }

  const messages = parseMessages(await req.json().catch(() => null));
  if (!messages) {
    return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const client = new Anthropic();
  const stream = client.beta.messages.stream(
    {
      model: "claude-opus-5-5",
      max_tokens: 64000,
      system: SYSTEM_PROMPT,
      messages,
      // 채팅은 깊게 고민할 일이 적어서 effort를 낮춰 빠르고 저렴하게 답하게 한다
      output_config: { effort: "low" },
      // 안전 필터가 답을 거절하면 Anthropic이 추천하는 다른 모델로 자동으로 다시 시도한다
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    // 사용자가 '중지'를 누르거나 창을 닫으면 Claude 요청도 멈춘다
    { signal: req.signal },
  );

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        // 답변 글자가 생기는 대로 바로 브라우저로 흘려보낸다
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send(event.delta.text);
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send(ERROR_MARKER + "이 질문에는 답할 수 없어요. 다르게 물어봐 주세요.");
        } else if (final.stop_reason === "max_tokens") {
          send("\n\n(답변이 너무 길어서 여기서 끊겼어요.)");
        }
      } catch (err) {
        if (!(err instanceof Anthropic.APIUserAbortError)) {
          console.error(err);
          send(ERROR_MARKER + errorMessage(err));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

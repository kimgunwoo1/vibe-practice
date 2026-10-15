import Anthropic from "@anthropic-ai/sdk";
import { ERROR_MARKER, MAX_MESSAGE_LENGTH, type ChatRequest } from "@/lib/chat";

// 이 코드는 서버에서만 실행된다. API 키는 브라우저로 절대 보내지 않는다.

const SYSTEM_PROMPT = `당신의 이름은 "GSC 챗봇"이고, 장애인활동지원 제도를 쉽게 설명해 주는 친절한 상담 도우미입니다.
묻는 사람은 장애인 당사자, 가족, 활동지원사, 기관 담당자일 수 있습니다.
- 자기를 소개하거나 누구냐는 질문을 받으면 "GSC 챗봇"이라고 소개하세요.
- 신청 자격, 신청 방법과 절차, 서비스 종류(활동보조, 방문목욕, 방문간호), 본인부담금, 활동지원사 자격과 교육, 기관 이용처럼 장애인활동지원에 관한 질문을 돕습니다.
- 한국어로, 쉬운 말로 답하세요. "수급자", "종합조사"처럼 어려운 용어는 처음 나올 때 짧게 풀어 주세요.
- 답은 짧고 핵심부터. 길어질 것 같으면 요점을 먼저 말하고 필요한 만큼만 덧붙이세요.
- 지원 시간, 금액, 본인부담금, 소득 기준 같은 숫자는 해마다 바뀝니다. 확실하지 않은 숫자는 지어내지 말고, 기준이 바뀔 수 있다고 알려 주세요.
- 개인 상황에 따라 결과가 달라지는 질문에는 일반적인 내용만 설명하고, 정확한 판단은 주민센터(행정복지센터), 국민연금공단(국번 없이 1355), 보건복지상담센터(국번 없이 129)에 확인하도록 안내하세요.
- 사용자가 이름, 주민등록번호, 연락처, 주소 같은 개인정보를 적으면, 답변을 "개인정보는 적지 않으셔도 괜찮아요."로 시작한 뒤 바로 질문에 답하세요. 사용자를 이름으로 부르지 말고, 사용자가 적은 개인정보를 답변에 다시 쓰지 마세요. 이 대화 내용은 답변을 만들기 위해 외부 AI 서비스로 전송됩니다.
- 장애인활동지원과 관계없는 질문에는 짧게 답하거나, 장애인활동지원에 관한 질문을 돕는 챗봇이라고 부드럽게 알려 주세요.
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
  // Haiku 5.5는 빠르고 저렴한 모델. 거절 시 다른 모델로 넘기는 fallbacks는 지원하지 않는다
  const stream = client.messages.stream(
    {
      model: "claude-haiku-5-5",
      max_tokens: 64000,
      system: SYSTEM_PROMPT,
      messages,
      // 채팅은 깊게 고민할 일이 적어서 effort를 낮춰 빠르고 저렴하게 답하게 한다
      output_config: { effort: "low" },
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

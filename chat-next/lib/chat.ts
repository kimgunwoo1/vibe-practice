// 서버(app/api/chat/route.ts)와 화면(components/Chat.tsx)이 함께 쓰는 약속

// 화면에 보여 주고 localStorage에 저장하는 대화 한 줄
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  error?: boolean; // 오류 안내 말풍선 (다음 질문 때 Claude에게 보내지 않는다)
};

// 브라우저 → 서버로 보내는 요청 본문
export type ChatRequest = {
  messages: { role: "user" | "assistant"; content: string }[];
};

// 서버는 답변 글자를 그대로 흘려보내다가, 문제가 생기면
// 이 표시 문자 뒤에 오류 문장을 붙여 보낸다. (보통 글에는 나오지 않는 문자)
export const ERROR_MARKER = "\u0000";

export const MAX_MESSAGE_LENGTH = 4000;

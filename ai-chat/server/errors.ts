import type { ContentfulStatusCode } from "hono/utils/http-status";

// 사용자에게 그대로 보여 줄 수 있는 한국어 메시지를 담는 오류
export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = () =>
  new ApiError(404, "NOT_FOUND", "대화를 찾을 수 없습니다.");

import { createMiddleware } from "hono/factory";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";

const COOKIE = "anon_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

// 로그인 대신 브라우저마다 무작위 ID를 발급해 서명한 쿠키에 담는다.
// 서명이 틀리면(조작된 쿠키) 새 ID를 발급한다.
export const anonId = createMiddleware<AppEnv>(async (c, next) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new ApiError(500, "CONFIG", "서버 설정이 끝나지 않았습니다. (SESSION_SECRET)");
  }

  let id = await getSignedCookie(c, secret, COOKIE);
  if (!id) {
    id = crypto.randomUUID();
    await setSignedCookie(c, COOKIE, id, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: ONE_YEAR,
    });
  }
  c.set("anonId", id);
  await next();
});

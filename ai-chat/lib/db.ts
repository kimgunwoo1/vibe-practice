import "server-only";
import mongoose from "mongoose";
import { ApiError } from "@/server/errors";

// 개발 서버는 코드를 고칠 때마다 모듈을 다시 불러온다.
// 연결을 globalThis에 보관해 두어야 연결이 계속 늘어나지 않는다.
const cache = globalThis as typeof globalThis & {
  mongooseConn?: Promise<typeof mongoose>;
};

export function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new ApiError(500, "CONFIG", "서버 설정이 끝나지 않았습니다. (MONGODB_URI)");

  cache.mongooseConn ??= mongoose
    .connect(uri, { dbName: process.env.MONGODB_DB_NAME || "ai-chat" })
    .catch((err) => {
      // 실패한 연결을 캐시에 남기지 않아야 다음 요청에서 다시 시도한다
      cache.mongooseConn = undefined;
      throw err;
    });
  return cache.mongooseConn;
}

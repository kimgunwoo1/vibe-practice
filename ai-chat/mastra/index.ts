import "server-only";
import { Mastra } from "@mastra/core";
import { MongoDBStore } from "@mastra/mongodb";
import { ApiError } from "@/server/errors";
import { counselor } from "./agents/counselor";

// 개발 서버의 핫 리로드 때 Mastra(와 MongoDB 연결)를 다시 만들지 않도록 캐시한다
const cache = globalThis as typeof globalThis & { mastra?: Mastra };

function createMastra() {
  return new Mastra({
    agents: { counselor },
    // 대화 스레드와 메시지는 Mastra가 같은 MongoDB 데이터베이스에 저장한다
    storage: new MongoDBStore({
      id: "ai-chat-storage",
      uri: process.env.MONGODB_URI!,
      dbName: process.env.MONGODB_DB_NAME || "ai-chat",
    }),
  });
}

export function getMastra() {
  cache.mastra ??= createMastra();
  return cache.mastra;
}

export async function getCounselor() {
  // 빠진 설정은 일반 오류 대신 무엇이 빠졌는지 알려 준다
  for (const key of ["MONGODB_URI", "ANTHROPIC_API_KEY"]) {
    if (!process.env[key]) {
      throw new ApiError(500, "CONFIG", `서버 설정이 끝나지 않았습니다. (${key})`);
    }
  }
  const agent = getMastra().getAgent("counselor");
  const memory = await agent.getMemory();
  if (!memory) throw new Error("상담 에이전트에 메모리가 설정되지 않았습니다.");
  return { agent, memory };
}

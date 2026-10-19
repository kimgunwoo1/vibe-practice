// 문서 검색(RAG)에 쓰는 임베딩 모델과 벡터 저장소.
// scripts/ingest.ts(Next.js 밖에서 실행)도 이 파일을 쓰므로 'server-only'를 넣지 않는다.
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { MongoDBVector } from "@mastra/mongodb";

export const DOCS_INDEX = "docs";
export const EMBEDDING_MODEL = "google/gemini-embedding-001";
// gemini-embedding-001의 기본 차원(3072) 대신 768을 쓴다. 저장 용량이 1/4이고 검색 품질 차이는 작다.
export const EMBEDDING_DIMENSION = 768;

export type Domain = "activity" | "work";

// 벡터 하나에 함께 저장하는 정보. 답변 끝에 출처를 표시할 때 쓴다.
export type ChunkMetadata = {
  domain: Domain;
  source: string; // 문서 이름 (예: 2026년 장애인활동지원 사업안내)
  year: number;
  page: string; // 문서에 인쇄된 쪽 번호 (없으면 PDF 쪽)
  text: string;
};

const cache = globalThis as typeof globalThis & {
  embedder?: ModelRouterEmbeddingModel;
  vectorStore?: MongoDBVector;
};

// 문서를 넣을 때와 질문을 검색할 때 taskType을 다르게 주면 검색 정확도가 올라간다
export async function embed(values: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") {
  cache.embedder ??= new ModelRouterEmbeddingModel(EMBEDDING_MODEL);
  const { embeddings } = await cache.embedder.doEmbed({
    values,
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSION, taskType } },
  });
  return embeddings;
}

export function getVectorStore() {
  cache.vectorStore ??= new MongoDBVector({
    id: "ai-chat-vector",
    uri: process.env.MONGODB_URI!,
    dbName: process.env.MONGODB_DB_NAME || "ai-chat",
  });
  return cache.vectorStore;
}

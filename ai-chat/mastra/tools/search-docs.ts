import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { DOCS_INDEX, embed, getVectorStore, type ChunkMetadata, type Domain } from "../rag";

const TOP_K = 10;

export type DocResult = Pick<ChunkMetadata, "source" | "year" | "page" | "text">;

// 사업안내에서 질문과 가까운 조각을 찾는다. 도구와 /api/chat(답하기 전 미리 검색)이 함께 쓴다.
// 검색어가 여러 개면 한 번에 임베딩해 동시에 찾고, 겹치는 조각을 빼고 번갈아 섞어 topK개를 돌려준다.
export async function searchDocuments(query: string | string[], domain: Domain, topK = TOP_K): Promise<DocResult[]> {
  const queries = Array.isArray(query) ? query : [query];
  const vectors = await embed(queries, "RETRIEVAL_QUERY");
  const store = getVectorStore();
  const lists = await Promise.all(
    vectors.map((queryVector) => store.query({ indexName: DOCS_INDEX, queryVector, topK, filter: { domain } })),
  );
  const seen = new Set<string>();
  const merged: DocResult[] = [];
  for (let i = 0; merged.length < topK && lists.some((l) => i < l.length); i++) {
    for (const list of lists) {
      const r = list[i];
      if (!r || seen.has(r.id) || merged.length >= topK) continue;
      seen.add(r.id);
      const m = r.metadata as ChunkMetadata;
      merged.push({ source: m.source, year: m.year, page: m.page, text: m.text });
    }
  }
  return merged;
}

export const searchDocs = createTool({
  id: "search-docs",
  description:
    "공식 사업안내 문서에서 질문과 관련된 부분을 찾는다. 제도에 관한 사실(자격, 신청 절차, 급여, 금액, 시간, 본인부담금 등)을 답하기 전에 반드시 먼저 부른다.",
  inputSchema: z.object({
    query: z.string().describe("찾을 내용. 사용자의 질문을 문서에 나올 법한 말로 바꿔 쓴다."),
    domain: z
      .enum(["activity", "work"])
      .describe("activity = 장애인활동지원, work = 장애인근로지원(근로지원인 서비스, 장애인 표준사업장)"),
  }),
  execute: async ({ query, domain }) => {
    try {
      return { results: await searchDocuments(query, domain) };
    } catch (err) {
      // 검색이 안 돼도 답변은 이어 가도록 빈 결과를 돌려준다 (검색어는 사용자 글이라 로그에 남기지 않는다)
      console.error("[search-docs] search failed", err);
      return { results: [], error: "문서 검색에 실패했습니다." };
    }
  },
});

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { DOCS_INDEX, embed, getVectorStore, type ChunkMetadata } from "../rag";

const TOP_K = 10;

export const searchDocs = createTool({
  id: "search-docs",
  description:
    "공식 사업안내 문서에서 질문과 관련된 부분을 찾는다. 제도에 관한 사실(자격, 신청 절차, 급여, 금액, 시간, 본인부담금 등)을 답하기 전에 반드시 먼저 부른다.",
  inputSchema: z.object({
    query: z.string().describe("찾을 내용. 사용자의 질문을 문서에 나올 법한 말로 바꿔 쓴다."),
    domain: z
      .enum(["activity", "work"])
      .describe("activity = 장애인활동지원, work = 장애인근로지원"),
  }),
  execute: async ({ query, domain }) => {
    try {
      const [queryVector] = await embed([query], "RETRIEVAL_QUERY");
      const results = await getVectorStore().query({
        indexName: DOCS_INDEX,
        queryVector,
        topK: TOP_K,
        filter: { domain },
      });
      return {
        results: results.map((r) => {
          const m = r.metadata as ChunkMetadata;
          return { source: m.source, year: m.year, page: m.page, text: m.text };
        }),
      };
    } catch (err) {
      // 검색이 안 돼도 답변은 이어 가도록 빈 결과를 돌려준다 (검색어는 사용자 글이라 로그에 남기지 않는다)
      console.error("[search-docs] search failed", err);
      return { results: [], error: "문서 검색에 실패했습니다." };
    }
  },
});

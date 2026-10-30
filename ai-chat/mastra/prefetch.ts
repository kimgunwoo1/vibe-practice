// 답하기 전에 서버가 사업안내를 미리 검색한다.
//
// Sonnet 5.5는 도구 결과를 받은 뒤에 쓰는 글을 다 쓸 때까지 붙잡았다가 한꺼번에 보낸다
// (도구 사이의 글을 "진행 메모"로 바꿔 보낼지 끝까지 정할 수 없어서). 그래서 검색을 도구로 하면
// 답이 한 글자도 흘러나오지 않는다. 검색 결과를 질문과 함께 넣어 주면 도구를 부르지 않고 바로 답을
// 흘려보내고, 검색을 몇 번씩 되풀이하는 시간도 없어진다. (2026-10-30 측정: 첫 글자 11~14초)
import type { Domain } from "./rag";
import type { DocResult } from "./tools/search-docs";

// 제도를 직접 말한 낱말. 기본은 활동지원이고, 근로지원 낱말이 있을 때만 근로지원으로 본다.
const WORK = /근로\s*지원|표준\s*사업장|직장에서|일터에서/;
const ACTIVITY = /활동\s*지원|활동\s*보조|방문\s*목욕|방문\s*간호/;

// 최근 질문부터 거슬러 올라가며 제도를 직접 말한 질문을 찾는다. 없으면 활동지원.
// (근로지원 이야기를 시작한 대화의 이어지는 질문도 근로지원으로 보기 위해)
export function pickDomain(userTextsNewestFirst: string[]): Domain {
  for (const text of userTextsNewestFirst) {
    const work = WORK.test(text);
    const activity = ACTIVITY.test(text);
    if (work && !activity) return "work";
    if (activity) return "activity";
  }
  return "activity";
}

// 검색어. "누가 받을 수 있어요?"처럼 짧은 이어지는 질문은 앞 질문을 붙여야 엉뚱한 쪽이 나오지 않는다.
export function buildQuery(userTextsNewestFirst: string[]): string {
  const [current, previous] = userTextsNewestFirst;
  return current.length < 40 && previous ? `${previous}\n${current}` : current;
}

// Haiku가 쓴 검색어 2개 + 원래 질문. 검색어를 못 만들면 원래 질문만 쓴다.
export async function writeQueries(question: string): Promise<string[]> {
  try {
    const { queryWriter } = await import("./agents/query-writer");
    const { text } = await queryWriter.generate(question, {
      providerOptions: { anthropic: { effort: "low" } },
    });
    const lines = text.split("\n").map((l) => l.replace(/^[-\d.)\s]+/, "").trim()).filter(Boolean);
    return [...lines.slice(0, 2), question];
  } catch (err) {
    console.error("[prefetch] query writer failed", err);
    return [question];
  }
}

const DOMAIN_NAME: Record<Domain, string> = { activity: "장애인활동지원", work: "장애인근로지원" };

export function formatDocs(domain: Domain, docs: DocResult[]): string {
  const body = docs.length
    ? docs.map((d) => `<조각 출처="${d.source}" 쪽="${d.page}">\n${d.text}\n</조각>`).join("\n")
    : "(찾은 내용 없음)";
  return `<사업안내_검색결과 분야="${DOMAIN_NAME[domain]}">\n${body}\n</사업안내_검색결과>`;
}

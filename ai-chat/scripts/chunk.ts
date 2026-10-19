// PDF 쪽 글자를 검색용 조각으로 나눈다. (ingest.ts에서 쓰고, 테스트하기 쉽게 따로 둔다)
import { MDocument } from "@mastra/rag";
import type { ChunkMetadata, Domain } from "../mastra/rag";

// 파일 이름 규칙: <분야>-<연도>-<문서 이름>.pdf (docs/README.md 참고)
export function parseFileName(fileName: string) {
  const m = fileName.match(/^(activity|work)-(\d{4})-(.+)\.pdf$/);
  if (!m) return null;
  const [, domain, year, title] = m;
  return {
    domain: domain as Domain,
    year: Number(year),
    source: `${year}년 ${title.replaceAll("-", " ")}`,
  };
}

// 쪽 맨 위나 맨 아래 줄에 인쇄된 쪽 번호 (예: "86", 앞부분은 "xxx" 같은 로마 숫자)
const PAGE_NUMBER = /^(\d{1,4}|[ivxlc]{1,7})$/i;
const TOC_LEADER = /[·.]{8,}/;
const COMPARISON_TABLE = /변경사항 비교표|\d{4}년도\s+\d{4}년도\s+변경사유/;

// 쪽마다 반복되는 머리글(예: "2026 장애인활동지원 사업안내")과 쪽 번호를 빼고,
// 인쇄된 쪽 번호를 찾는다. 찾지 못하면 PDF 쪽 번호를 쓴다.
export function cleanPages(pages: string[]) {
  const lineCount = new Map<string, number>();
  for (const page of pages) {
    for (const line of new Set(page.split("\n").map((l) => l.trim()))) {
      lineCount.set(line, (lineCount.get(line) ?? 0) + 1);
    }
  }
  const repeated = (line: string) => pages.length >= 10 && (lineCount.get(line) ?? 0) > pages.length / 3;

  return pages.map((page, i) => {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
    // 목차 쪽(점선 "······ 3"이 많은 쪽)은 검색 결과 자리만 차지하므로 뺀다.
    // 전년도와 비교하는 표는 글자로 뽑으면 두 해의 숫자가 섞여 지난해 금액을 답할 수 있으므로 뺀다
    // (같은 내용이 본문에 올해 기준으로 있다).
    const isToc = lines.filter((l) => TOC_LEADER.test(l)).length >= lines.length * 0.3;
    if (isToc || COMPARISON_TABLE.test(page)) return { page: String(i + 1), text: "" };
    const edges = [0, 1, lines.length - 1].filter((j) => j >= 0 && j < lines.length);
    const numberLine = edges.find((j) => PAGE_NUMBER.test(lines[j]));
    return {
      page: numberLine === undefined ? String(i + 1) : lines[numberLine],
      text: lines.filter((line, j) => j !== numberLine && !repeated(line)).join("\n"),
    };
  });
}

export async function chunkPages(
  pages: { page: string; text: string }[],
  info: { domain: Domain; year: number; source: string },
) {
  const doc = new MDocument({
    docs: pages
      .filter((p) => p.text.length >= 30) // 빈 쪽, 그림만 있는 쪽
      .map((p) => ({ text: p.text, metadata: { ...info, page: p.page } })),
    type: "text",
  });
  const chunks = await doc.chunk({ strategy: "recursive", maxSize: 1000, overlap: 150 });
  return chunks
    .filter((c) => c.text.trim().length >= 20)
    .map((c) => ({ ...(c.metadata as Omit<ChunkMetadata, "text">), text: c.text.trim() }));
}

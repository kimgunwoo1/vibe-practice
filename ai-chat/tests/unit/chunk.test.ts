import { describe, expect, it } from "vitest";
import { chunkPages, cleanPages, parseFileName } from "@/scripts/chunk";

describe("문서 나누기", () => {
  it("파일 이름에서 분야, 연도, 문서 이름을 읽는다", () => {
    expect(parseFileName("activity-2026-장애인활동지원-사업안내.pdf")).toEqual({
      domain: "activity",
      year: 2026,
      source: "2026년 장애인활동지원 사업안내",
    });
    expect(parseFileName("사업안내.pdf")).toBeNull();
  });

  it("반복되는 머리글과 쪽 번호를 빼고, 인쇄된 쪽 번호를 찾는다", () => {
    const pages = Array.from({ length: 12 }, (_, i) => `${i + 1}\n2026 사업안내\n본문 ${i + 1}쪽 내용`);
    const cleaned = cleanPages(pages);
    expect(cleaned[4]).toEqual({ page: "5", text: "본문 5쪽 내용" });
  });

  it("목차와 전년도 비교표 쪽은 뺀다", () => {
    const toc = "목 차\n1. 지원 대상자 ··········· 3\n2. 신청 ··········· 7";
    const comparison = "주요 변경사항 비교표\n페이지 2025년도 2026년도 변경사유\n월 한도액 1,997,000원 2,076,000원";
    const [a, b] = cleanPages([toc, comparison]);
    expect(a.text).toBe("");
    expect(b.text).toBe("");
  });

  it("조각마다 출처와 쪽 번호를 붙인다", async () => {
    const info = { domain: "activity" as const, year: 2026, source: "2026년 장애인활동지원 사업안내" };
    const chunks = await chunkPages(
      [
        { page: "3", text: "가. 신청자격\n○ 6세 이상부터 65세 미만의 장애인복지법상 등록 장애인" },
        { page: "4", text: "" },
      ],
      info,
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ ...info, page: "3" });
    expect(chunks[0].text).toContain("신청자격");
  });
});

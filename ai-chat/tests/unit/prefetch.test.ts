import { describe, expect, it } from "vitest";
import { buildQuery, formatDocs, pickDomain } from "@/mastra/prefetch";

describe("pickDomain", () => {
  it("제도를 말하지 않으면 활동지원", () => {
    expect(pickDomain(["신청은 어디서 하나요?"])).toBe("activity");
  });

  it("근로지원·표준사업장을 말하면 근로지원", () => {
    expect(pickDomain(["근로지원인은 어떻게 신청하나요?"])).toBe("work");
    expect(pickDomain(["표준사업장 인증 기준은?"])).toBe("work");
  });

  it("근로지원 대화의 이어지는 질문도 근로지원", () => {
    expect(pickDomain(["누가 받을 수 있어요?", "근로지원인 서비스 알려 주세요"])).toBe("work");
  });

  it("다시 활동지원을 말하면 활동지원으로 돌아간다", () => {
    expect(pickDomain(["활동지원은요?", "근로지원인 서비스 알려 주세요"])).toBe("activity");
  });
});

describe("buildQuery", () => {
  it("짧은 이어지는 질문에는 앞 질문을 붙인다", () => {
    expect(buildQuery(["누가 받아요?", "근로지원인 서비스"])).toBe("근로지원인 서비스\n누가 받아요?");
  });

  it("긴 질문이나 첫 질문은 그대로 쓴다", () => {
    expect(buildQuery(["신청은 어디서 하나요?"])).toBe("신청은 어디서 하나요?");
    const long = "활동지원 본인부담금은 소득 수준에 따라 어떻게 달라지고 면제되는 경우는 어떤 경우인가요?";
    expect(buildQuery([long, "이전 질문"])).toBe(long);
  });
});

describe("formatDocs", () => {
  it("출처와 쪽을 붙여 감싼다", () => {
    const text = formatDocs("activity", [{ source: "2026년 사업안내", year: 2026, page: "78", text: "본문" }]);
    expect(text).toContain('분야="장애인활동지원"');
    expect(text).toContain('<조각 출처="2026년 사업안내" 쪽="78">');
  });

  it("결과가 없으면 없다고 적는다", () => {
    expect(formatDocs("work", [])).toContain("(찾은 내용 없음)");
  });
});

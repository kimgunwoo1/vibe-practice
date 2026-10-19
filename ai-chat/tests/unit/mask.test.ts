import { describe, expect, it } from "vitest";
import { maskPersonalInfo } from "@/lib/mask";

describe("maskPersonalInfo", () => {
  it("주민등록번호를 가린다", () => {
    expect(maskPersonalInfo("제 번호는 900101-1234567 입니다")).toBe("제 번호는 *** 입니다");
    expect(maskPersonalInfo("9001011234567")).toBe("***");
  });

  it("휴대전화 번호를 가린다", () => {
    expect(maskPersonalInfo("010-1234-5678로 연락 주세요")).toBe("***로 연락 주세요");
    expect(maskPersonalInfo("01012345678")).toBe("***");
  });

  it("이메일을 가린다", () => {
    expect(maskPersonalInfo("hong@example.co.kr")).toBe("***");
  });

  it("제도 관련 숫자는 그대로 둔다", () => {
    const text = "활동지원 1355, 근로지원 1588-1519, 하루 8시간";
    expect(maskPersonalInfo(text)).toBe(text);
  });
});

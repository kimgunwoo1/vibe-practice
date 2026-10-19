// 메시지를 에이전트에 넘기거나 저장하기 전에 개인정보 패턴을 가린다.
// 완벽하지 않으므로 화면의 "개인정보 입력 금지" 안내와 함께 쓴다.
const PATTERNS: RegExp[] = [
  // 주민등록번호·외국인등록번호: 생년월일 6자리 + 7자리
  /\b\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\s*-?\s*[1-8]\d{6}\b/g,
  // 휴대전화 번호
  /\b01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}\b/g,
  // 이메일
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
];

export function maskPersonalInfo(text: string): string {
  return PATTERNS.reduce((acc, re) => acc.replace(re, "***"), text);
}

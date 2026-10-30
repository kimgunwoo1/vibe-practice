// 최신 소식(제도 개편, 예산, 보도자료)을 찾는 Claude 웹 검색 도구.
// 검색은 Anthropic 서버가 하므로 execute가 없다. 검색 1,000번에 $10이 따로 든다.
//
// Mastra 기본 webSearchTool은 옛 버전(web_search_20250305)을 옵션 없이 붙인다.
// 사이트·횟수를 제한하려고 Mastra가 그대로 넘기는 provider-defined 도구 모양을 직접 만든다
// (@ai-sdk/anthropic의 anthropic.tools.webSearch_20260209()와 같은 값, 패키지 설치 없이).

// 검색할 사이트. 하위 도메인도 포함된다(예: kbs.co.kr → news.kbs.co.kr). 최대 64개.
const ALLOWED_DOMAINS = [
  // 정부·공공기관
  "mohw.go.kr", // 보건복지부
  "korea.kr", // 대한민국 정책브리핑
  "bokjiro.go.kr", // 복지로
  "nps.or.kr", // 국민연금공단 (활동지원 수급자격 심사)
  "kead.or.kr", // 한국장애인고용공단 (근로지원인)
  "ssis.or.kr", // 사회보장정보원
  "law.go.kr", // 국가법령정보센터
  // 장애·복지 전문 매체
  "ablenews.co.kr", // 에이블뉴스
  "beminor.com", // 비마이너
  "welfarenews.net", // 복지뉴스
  // 통신사·방송·일간지
  "yna.co.kr",
  "newsis.com",
  "news1.kr",
  "kbs.co.kr",
  "imbc.com",
  "sbs.co.kr",
  "hani.co.kr",
  "khan.co.kr",
  "chosun.com",
  "joongang.co.kr",
  "donga.com",
  "hankookilbo.com",
];

export const webSearch = {
  type: "provider-defined",
  id: "anthropic.web_search_20260209",
  name: "web_search",
  args: {
    // 질문 하나에 검색은 3번까지 (비용과 응답 시간)
    maxUses: 3,
    allowedDomains: ALLOWED_DOMAINS,
    userLocation: { type: "approximate", country: "KR", timezone: "Asia/Seoul" },
  },
} as const;

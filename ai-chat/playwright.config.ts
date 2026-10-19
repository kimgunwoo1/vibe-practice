import { defineConfig } from "@playwright/test";

// 화면 테스트는 /api 요청을 모두 가짜 응답으로 가로채므로 API 키나 DB 없이 돌아간다
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

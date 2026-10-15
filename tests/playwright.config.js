// Playwright 설정: 저장소의 HTML 파일을 file:// 로 직접 열어서 테스트합니다 (서버 필요 없음)
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    locale: 'ko-KR',
    trace: 'retain-on-failure', // 실패하면 단계별 기록을 남깁니다 (npx playwright show-trace)
  },
});

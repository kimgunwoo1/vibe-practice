import { expect, test, type Page } from "@playwright/test";

const THREAD = "22222222-2222-4222-8222-222222222222";

// 가짜 서버: 대화 목록과 채팅 응답을 메모리에 들고 있다
async function mockApi(page: Page) {
  const state = {
    conversations: [] as { id: string; title: string; pinned: boolean; updatedAt: string }[],
  };

  await page.route("**/api/conversations", (route) =>
    route.fulfill({ json: { conversations: state.conversations } }),
  );
  await page.route(`**/api/conversations/${THREAD}`, (route) => {
    if (route.request().method() === "DELETE") state.conversations = [];
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/chat", (route) => {
    state.conversations = [
      { id: THREAD, title: "활동지원 신청", pinned: false, updatedAt: new Date().toISOString() },
    ];
    return route.fulfill({
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Conversation-Id": THREAD },
      body: "주민센터에서 **신청**할 수 있어요.",
    });
  });
  return state;
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
});

test("질문을 보내면 답변이 마크다운으로 보인다", async ({ page }) => {
  await page.getByLabel("질문 입력").fill("활동지원은 어디서 신청하나요?");
  await page.getByLabel("질문 입력").press("Enter");

  await expect(page.locator("#messages")).toContainText("활동지원은 어디서 신청하나요?");
  await expect(page.locator("#messages strong")).toHaveText("신청");
  await expect(page.locator("#conversation-list")).toContainText("활동지원 신청");
});

test("추천 질문을 누르면 바로 보낸다", async ({ page }) => {
  await page.getByRole("button", { name: "근로지원인 서비스는 어떤 도움을 주나요?" }).click();
  await expect(page.locator("#messages")).toContainText("주민센터에서");
});

test("대화 삭제는 두 번 눌러야 한다", async ({ page }) => {
  await page.getByRole("button", { name: "활동지원은 누가 받을 수 있나요?" }).click();
  const list = page.locator("#conversation-list");
  await expect(list).toContainText("활동지원 신청");

  await page.getByRole("button", { name: '"활동지원 신청" 삭제' }).click();
  await expect(list).toContainText("활동지원 신청");
  await page.getByRole("button", { name: '"활동지원 신청" 정말 삭제' }).click();

  await expect(page.getByText("아직 대화가 없어요.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "안녕하세요! 무엇이 궁금하신가요?" })).toBeVisible();
});

test("서버 오류는 알림으로 보여 준다", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 429,
      json: { error: { code: "RATE_LIMITED", message: "1분 뒤에 다시 시도해 주세요." } },
    }),
  );
  await page.getByLabel("질문 입력").fill("안녕하세요");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.locator("#error")).toHaveText("1분 뒤에 다시 시도해 주세요.");
});

test("다크 모드와 글자 크기 설정이 새로고침 후에도 유지된다", async ({ page }) => {
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: "다크 모드 바꾸기" }).click();
  await page.getByRole("button", { name: "글자 크기 바꾸기" }).click();
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", before === "dark" ? "light" : "dark");
  await expect(html).toHaveAttribute("data-font", "large");
});

// todo/index.html 테스트
// 각 테스트는 새 브라우저 환경에서 시작하므로 localStorage가 비어 있습니다.
const { test, expect } = require('@playwright/test');
const path = require('path');

const PAGE_URL = 'file://' + path.resolve(__dirname, '../todo/index.html');

// 할 일을 하나 추가하는 도우미 함수
async function addTodo(page, text, due) {
  await page.locator('#input').fill(text);
  if (due) await page.locator('#due').fill(due);
  await page.locator('.add-btn').click();
}

// 목록의 할 일 항목들 (비어 있을 때 나오는 안내 문구는 제외)
const items = page => page.locator('#list li:not(.empty)');

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE_URL);
});

test('처음에는 빈 목록 안내가 보이고, 일괄 버튼은 숨겨져 있다', async ({ page }) => {
  await expect(page.locator('#list li.empty')).toHaveText('할 일이 없습니다 🎉');
  await expect(page.locator('#count')).toHaveText('남은 할 일 0개 · 완료 0개');
  await expect(page.locator('#toggle-all')).toBeHidden();
  await expect(page.locator('#clear')).toBeHidden();
});

test('할 일을 추가하면 목록에 나타나고 입력창이 비워진다', async ({ page }) => {
  await addTodo(page, '우유 사기');

  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first().locator('.text')).toHaveText('우유 사기');
  await expect(page.locator('#input')).toHaveValue('');
  await expect(page.locator('#count')).toHaveText('남은 할 일 1개 · 완료 0개');
});

test('공백만 입력하면 추가되지 않는다', async ({ page }) => {
  await addTodo(page, '   ');
  await expect(items(page)).toHaveCount(0);
});

test('Enter 키로도 추가할 수 있다', async ({ page }) => {
  await page.locator('#input').fill('운동하기');
  await page.locator('#input').press('Enter');
  await expect(items(page)).toHaveCount(1);
});

test('체크하면 완료 처리되고 진행률이 올라간다', async ({ page }) => {
  await addTodo(page, '하나');
  await addTodo(page, '둘');

  await items(page).first().locator('input[type="checkbox"]').check();

  await expect(items(page).first()).toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('남은 할 일 1개 · 완료 1개');
  await expect(page.locator('#progress')).toHaveAttribute('style', /width: 50%/);
});

test('필터로 진행 중 / 완료 항목만 볼 수 있다', async ({ page }) => {
  await addTodo(page, '진행 중인 일');
  await addTodo(page, '끝난 일');
  await items(page).nth(1).locator('input[type="checkbox"]').check();

  await page.getByRole('button', { name: '진행 중' }).click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText('진행 중인 일');

  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText('끝난 일');

  await page.getByRole('button', { name: '전체' }).click();
  await expect(items(page)).toHaveCount(2);
});

test('완료 필터에서 새 할 일을 추가하면 전체 보기로 돌아간다', async ({ page }) => {
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await addTodo(page, '새 할 일');

  await expect(page.getByRole('button', { name: '전체' })).toHaveClass(/active/);
  await expect(items(page)).toHaveCount(1);
});

test('더블클릭으로 수정하고 Enter로 저장한다', async ({ page }) => {
  await addTodo(page, '오타있는 할일');

  await items(page).first().locator('.text').dblclick();
  const editor = page.locator('.edit-input');
  await expect(editor).toBeFocused();
  await editor.fill('고친 할 일');
  await editor.press('Enter');

  await expect(items(page).first().locator('.text')).toHaveText('고친 할 일');
});

test('수정 중 Esc를 누르면 원래 내용이 유지된다', async ({ page }) => {
  await addTodo(page, '원래 내용');

  await items(page).first().getByTitle('수정').click();
  const editor = page.locator('.edit-input');
  await expect(editor).toBeFocused();
  await editor.fill('바뀌면 안 됨');
  await editor.press('Escape');

  await expect(items(page).first().locator('.text')).toHaveText('원래 내용');
});

test('× 버튼으로 삭제한다', async ({ page }) => {
  await addTodo(page, '지울 일');
  await items(page).first().getByTitle('삭제').click();
  await expect(items(page)).toHaveCount(0);
});

test('모두 완료 / 모두 해제 버튼', async ({ page }) => {
  await addTodo(page, '하나');
  await addTodo(page, '둘');

  const toggleAll = page.locator('#toggle-all');
  await toggleAll.click();
  await expect(page.locator('#count')).toHaveText('남은 할 일 0개 · 완료 2개');
  await expect(toggleAll).toHaveText('모두 해제');

  await toggleAll.click();
  await expect(page.locator('#count')).toHaveText('남은 할 일 2개 · 완료 0개');
  await expect(toggleAll).toHaveText('모두 완료');
});

test('완료 항목 삭제는 두 번 눌러야 지워진다', async ({ page }) => {
  await addTodo(page, '남길 일');
  await addTodo(page, '지울 일');
  await items(page).nth(1).locator('input[type="checkbox"]').check();

  const clear = page.locator('#clear');
  await clear.click();
  await expect(clear).toHaveText('한 번 더 누르면 삭제');
  await expect(items(page)).toHaveCount(2); // 아직 안 지워짐

  await clear.click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText('남길 일');
});

test('완료 항목 삭제 확인은 3초 뒤 원래대로 돌아간다', async ({ page }) => {
  await page.clock.install(); // 시간을 직접 조종해서 3초를 기다리지 않습니다
  await page.reload();
  await addTodo(page, '끝난 일');
  await items(page).first().locator('input[type="checkbox"]').check();

  const clear = page.locator('#clear');
  await clear.click();
  await expect(clear).toHaveText('한 번 더 누르면 삭제');

  await page.clock.runFor(3000);
  await expect(clear).toHaveText('완료 항목 삭제');
  await expect(items(page)).toHaveCount(1);
});

test('마감일이 지난 할 일은 빨간색(overdue)으로 표시된다', async ({ page }) => {
  await addTodo(page, '밀린 일', '2000-01-01');

  const meta = items(page).first().locator('.meta');
  await expect(meta).toContainText('일 지남');
  await expect(meta).toHaveClass(/overdue/);

  // 완료하면 더 이상 overdue가 아님
  await items(page).first().locator('input[type="checkbox"]').check();
  await expect(items(page).first().locator('.meta')).not.toHaveClass(/overdue/);
});

test('마감일이 오늘/내일이면 말로 표시된다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T09:00:00'));
  await page.reload();

  await addTodo(page, '오늘 할 일', '2026-10-15');
  await addTodo(page, '내일 할 일', '2026-10-16');
  await addTodo(page, '나중 할 일', '2026-10-20');

  await expect(items(page).nth(0).locator('.meta')).toHaveText('📅 오늘까지');
  await expect(items(page).nth(1).locator('.meta')).toHaveText('📅 내일까지');
  await expect(items(page).nth(2).locator('.meta')).toHaveText('📅 D-5 (10/20)');
});

test('새로고침해도 할 일이 남아 있다 (localStorage)', async ({ page }) => {
  await addTodo(page, '저장될 일');
  await items(page).first().locator('input[type="checkbox"]').check();

  await page.reload();

  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toHaveClass(/done/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('todo-app')));
  expect(saved[0]).toMatchObject({ text: '저장될 일', done: true, due: null });
});

test('다크 모드 전환이 저장되고 새로고침 후에도 유지된다', async ({ page }) => {
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  const after = before === 'dark' ? 'light' : 'dark';

  await page.locator('#theme').click();
  await expect(html).toHaveAttribute('data-theme', after);

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after);
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(after);
});

test('사용자가 입력한 HTML은 글자 그대로 보인다 (textContent)', async ({ page }) => {
  await addTodo(page, '<b>굵게</b>');
  await expect(items(page).first().locator('.text')).toHaveText('<b>굵게</b>');
  await expect(items(page).first().locator('b')).toHaveCount(0);
});

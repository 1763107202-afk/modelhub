const { test, expect } = require('@playwright/test');

// Never permit a browser test to contact the production database or any external host.
// Runs locally against a file served from loopback and requires ?demo=1.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === '8765') return route.continue();
    return route.abort();
  });
  await page.goto('/competition-live/index.html?demo=1');
  await expect(page.locator('body')).toHaveAttribute('data-view', 'screen');
  await expect(page.getByLabel('36支队伍实时积分排行榜')).toBeVisible();
});

test('audience board fits 1920 x 1080 and renders all 36 teams', async ({ page }) => {
  await expect(page.locator('.v6-rank-row')).toHaveCount(36);
  const sizes = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    screenHeight: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    screenWidth: window.innerWidth
  }));
  expect(sizes.documentHeight).toBeLessThanOrEqual(sizes.screenHeight + 2);
  expect(sizes.documentWidth).toBeLessThanOrEqual(sizes.screenWidth + 2);
});

test('demo judge can enter a score and audience sees it', async ({ page }) => {
  await page.locator('[data-nav="judge"]').click();
  await page.locator('#accessCode').fill('123456');
  await page.locator('#authForm button[type="submit"]').click();
  await expect(page.getByText('裁判实时录分台')).toBeVisible();
  // The seeded demo starts at round 4 with unfinished teams.
  await page.locator('#scoreInput').fill('92.50');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#scoreForm button[type="submit"]').click();
  await expect(page.locator('#message')).toContainText('成绩已提交');
  await page.locator('[data-nav="screen"]').click();
  await expect(page.locator('.v6-rank-score').filter({ hasText: '92.50' })).toHaveCount(1);
});

test('admin reset requires explicit confirmation and clears demo scores only', async ({ page }) => {
  await page.locator('[data-nav="control"]').click();
  await page.locator('#accessCode').fill('123456');
  await page.locator('#authForm button[type="submit"]').click();
  await expect(page.locator('#resetCompetition')).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#resetCompetition').click();
  // Cancel must not reset the seeded demo score count.
  await expect(page.locator('.metric').filter({ hasText: '已确认成绩' })).toContainText('6 /36');
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('清空测试成绩');
    else await dialog.accept();
  });
  await page.locator('#resetCompetition').click();
  await expect(page.locator('.metric').filter({ hasText: '已确认成绩' })).toContainText('0 /36');
  await expect(page.locator('.metric').filter({ hasText: '比赛轮次' })).toContainText('01 /18');
});

test('demo does not call any remote API even during navigation', async ({ page }) => {
  const remote = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:8765/')) remote.push(request.url());
  });
  await page.locator('[data-nav="judge"]').click();
  await page.locator('[data-nav="control"]').click();
  await page.locator('[data-nav="screen"]').click();
  // External font CSS is allowed to be attempted but blocked before the network.
  expect(remote.filter(url => /supabase|\/rest\/v1\//i.test(url))).toEqual([]);
});

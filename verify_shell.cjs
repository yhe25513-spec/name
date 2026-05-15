const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('=== 1) Login page — CSS variable check ===');
  await page.goto('http://localhost:3000/login', { timeout: 15000, waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Check new game CSS variables
  const vars = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      '--game-sidebar-w': s.getPropertyValue('--game-sidebar-w').trim(),
      '--game-status-w': s.getPropertyValue('--game-status-w').trim(),
      '--game-topbar-h': s.getPropertyValue('--game-topbar-h').trim(),
      '--game-space-1': s.getPropertyValue('--game-space-1').trim(),
      '--game-radius-sm': s.getPropertyValue('--game-radius-sm').trim(),
      '--game-radius-lg': s.getPropertyValue('--game-radius-lg').trim(),
    };
  });
  Object.entries(vars).forEach(([k, v]) => {
    console.log(`   ${k}: ${v ? '✅ ' + v : '❌'}`);
  });

  // Check game-shell class exists in the stylesheet
  const gameShellExists = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === '.game-shell') return true;
        }
      } catch (e) { /* cross-origin */ }
    }
    return false;
  });
  console.log(`   .game-shell in stylesheets: ${gameShellExists ? '✅' : '❌'}`);

  // Register and login
  console.log('\n=== 2) Register test account ===');
  const testUser = 'test' + Date.now().toString(36);
  const testPass = 'test123456';

  // Switch to register tab
  const regTab = page.locator('button', { hasText: '注册' });
  if (await regTab.count() > 0) await regTab.click();
  await page.waitForTimeout(300);

  // Fill register form
  await page.locator('input[placeholder*="用户名"]').first().fill(testUser);
  await page.locator('input[type="password"]').first().fill(testPass);
  await page.locator('button[type="submit"]').filter({ hasText: /注册/ }).first().click();
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log(`   After register: ${url.includes('/login') ? 'still at login' : '✅ redirected'}`);

  // If still at login, manually log in
  if (url.includes('/login')) {
    const loginTab = page.locator('button', { hasText: '登录' }).first();
    if (await loginTab.count() > 0) await loginTab.click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder*="用户名"]').first().fill(testUser);
    await page.locator('input[type="password"]').first().fill(testPass);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
    console.log(`   After login: ${page.url()}`);
  }

  // Go to game page
  console.log('\n=== 3) Game page ===');
  await page.goto('http://localhost:3000/game', { timeout: 15000, waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const gameUrl = page.url();
  console.log(`   Game page URL: ${gameUrl}`);

  if (gameUrl.includes('/game') && !gameUrl.includes('/login')) {
    await page.screenshot({ path: '/tmp/game_hub.png', fullPage: true });
    console.log('   ✅ On game page, screenshot: /tmp/game_hub.png');
  } else {
    console.log('   ❌ Not on game page');
  }

  await browser.close();
  console.log('\nDone');
})();

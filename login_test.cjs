const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // 1) 注册测试账号
  console.log('=== 1) 注册测试账号 ===');
  await page.goto('http://localhost:3000/login', { timeout: 15000, waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 切换到注册标签
  const registerTab = page.locator('button', { hasText: '注册' });
  if (await registerTab.count() > 0) {
    await registerTab.click();
    await page.waitForTimeout(300);
  }
  console.log('   已切换到注册标签');

  // 填写注册表单
  const testUser = 'testplayer' + Date.now().toString(36);
  const testPass = 'test123456';

  const usernameInput = page.locator('input[placeholder*="用户名"]').first();
  await usernameInput.fill(testUser);
  console.log(`   用户名: ${testUser}`);

  const passwordInputs = page.locator('input[type="password"]');
  const pwCount = await passwordInputs.count();
  console.log(`   密码输入框数量: ${pwCount}`);

  // 注册表单的密码框
  if (pwCount >= 1) {
    await passwordInputs.nth(0).fill(testPass);
  } else {
    // 也有可能只有一个，fill 注册表单的
    const regPwInput = page.locator('input[placeholder*="密码"]').first();
    await regPwInput.fill(testPass);
  }

  // 点击注册按钮
  const regBtn = page.locator('button[type="submit"]').filter({ hasText: '注册' });
  if (await regBtn.count() > 0) {
    await regBtn.click();
    console.log('   已点击注册按钮');
  } else {
    // 尝试找包含"注册并开始冒险"的按钮
    const altRegBtn = page.locator('button').filter({ hasText: '注册并开始冒险' });
    if (await altRegBtn.count() > 0) {
      await altRegBtn.click();
      console.log('   已点击备用注册按钮');
    }
  }

  await page.waitForTimeout(3000);

  // 检查是否跳转到首页（注册成功会自动登录并跳转）
  const currentUrl = page.url();
  console.log(`   当前 URL: ${currentUrl}`);

  // 2) 如果注册后还在登录页，尝试手动登录
  if (currentUrl.includes('/login')) {
    console.log('\n=== 2) 尝试登录 ===');
    // 切换到登录标签
    const loginTab = page.locator('button', { hasText: '登录' }).first();
    if (await loginTab.count() > 0) {
      await loginTab.click();
      await page.waitForTimeout(300);
    }

    // 填写登录表单
    const loginUsernameInput = page.locator('input[placeholder*="用户名"]').first();
    await loginUsernameInput.fill(testUser);

    // 登录表单的密码框
    const loginPwInputs = page.locator('input[type="password"]');
    const loginPwCount = await loginPwInputs.count();
    if (loginPwCount >= 2) {
      await loginPwInputs.nth(1).fill(testPass);
    } else if (loginPwCount >= 1) {
      await loginPwInputs.nth(0).fill(testPass);
    }

    const loginBtn = page.locator('button[type="submit"]').first();
    await loginBtn.click();
    console.log('   已点击登录按钮');
    await page.waitForTimeout(3000);
    console.log(`   登录后 URL: ${page.url()}`);
  }

  // 3) 尝试导航到游戏页面
  console.log('\n=== 3) 导航到游戏页面 ===');
  await page.goto('http://localhost:3000/game/397a44fe-6ab6-40aa-b207-192ce27076e1', { timeout: 15000, waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log(`   游戏页 URL: ${page.url()}`);

  // 检查是否还在登录页（未登录）
  if (page.url().includes('/login')) {
    console.log('   ❌ 需要登录才能访问游戏页面');
    console.log('   请打开 http://localhost:3000/login 手动注册/登录');
  } else {
    console.log('   ✅ 已进入游戏页面');
    await page.screenshot({ path: '/tmp/game_page.png', fullPage: true });
    console.log('   截图: /tmp/game_page.png');

    // 检查关键元素
    const hasSidePanel = await page.locator('aside, [class*="side"], [class*="Side"]').count();
    const hasChatArea = await page.locator('[class*="chat"], [class*="Chat"], [class*="story"]').count();
    const hasInput = await page.locator('input, textarea').count();
    console.log(`   侧边栏: ${hasSidePanel > 0 ? '✅' : '❌'}`);
    console.log(`   聊天区: ${hasChatArea > 0 ? '✅' : '❌'}`);
    console.log(`   输入框: ${hasInput > 0 ? '✅' : '❌'}`);

    // 检查移动端 Tab 栏
    const mobileNav = page.locator('nav');
    const navCount = await mobileNav.count();
    console.log(`   导航栏: ${navCount} 个`);
  }

  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} 控制台错误:`);
    errors.forEach(e => console.log(`   ${e.slice(0, 200)}`));
  } else {
    console.log('\n✅ 无控制台错误');
  }

  await browser.close();
  console.log('\nDone');
})();

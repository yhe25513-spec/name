const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // 1) 先到登录页
  console.log('=== 1) 登录页 ===');
  await page.goto('http://localhost:3000/login', { timeout: 15000, waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/step1_login.png', fullPage: true });
  console.log('   截图: /tmp/step1_login.png');

  // 2) 检查页面上的输入框和按钮
  const inputs = await page.locator('input').all();
  const buttons = await page.locator('button').all();
  console.log(`   输入框: ${inputs.length}, 按钮: ${buttons.length}`);

  // 尝试找登录表单并填写 (NextAuth 可能用不同的表单)
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="邮箱"], input[placeholder*="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

  if (await emailInput.count() > 0) {
    console.log('   找到邮箱输入框');
  }
  if (await passwordInput.count() > 0) {
    console.log('   找到密码输入框');
  }

  // 3) 检查 CSS 变量是否注入
  console.log('\n=== 2) CSS 变量检查 ===');
  const vars = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      '--bg-primary': styles.getPropertyValue('--bg-primary').trim(),
      '--accent': styles.getPropertyValue('--accent').trim(),
      '--glass-bg': styles.getPropertyValue('--glass-bg').trim(),
      '--glass-blur': styles.getPropertyValue('--glass-blur').trim(),
      '--glass-border': styles.getPropertyValue('--glass-border').trim(),
      '--glow': styles.getPropertyValue('--glow').trim(),
      '--btn-glow': styles.getPropertyValue('--btn-glow').trim(),
      '--accent2': styles.getPropertyValue('--accent2').trim(),
      '--danger': styles.getPropertyValue('--danger').trim(),
      '--warning': styles.getPropertyValue('--warning').trim(),
      '--glow-accent': styles.getPropertyValue('--glow-accent').trim(),
      '--hp-bar-fill': styles.getPropertyValue('--hp-bar-fill').trim(),
      '--shadow': styles.getPropertyValue('--shadow').trim(),
    };
  });
  Object.entries(vars).forEach(([k, v]) => {
    console.log(`   ${k}: ${v ? '✅ ' + v.slice(0, 60) : '❌ 未设置'}`);
  });

  // 4) 检查 body::before/::after 伪元素是否存在
  console.log('\n=== 3) 伪元素检查 ===');
  const pseudoCheck = await page.evaluate(() => {
    const beforeStyle = getComputedStyle(document.body, '::before');
    const afterStyle = getComputedStyle(document.body, '::after');
    return {
      beforeBg: beforeStyle.backgroundImage,
      beforePosition: beforeStyle.position,
      afterBg: afterStyle.backgroundImage,
      afterPosition: afterStyle.position,
    };
  });
  console.log(`   body::before bg: ${pseudoCheck.beforeBg !== 'none' ? '✅' : '❌'}`);
  console.log(`   body::after bg: ${pseudoCheck.afterBg !== 'none' ? '✅' : '❌'}`);

  // 5) 检查动画关键帧
  console.log('\n=== 4) 关键帧检查 ===');
  const animCheck = await page.evaluate(() => {
    const el1 = document.createElement('div');
    el1.style.animation = 'typing-bounce 1s';
    const el2 = document.createElement('div');
    el2.style.animation = 'particle-float 1s';
    return {
      typing: el1.style.animation.includes('typing-bounce'),
      particle: el2.style.animation.includes('particle-float'),
    };
  });
  console.log(`   typing-bounce: ${animCheck.typing ? '✅' : '❌'}`);
  console.log(`   particle-float: ${animCheck.particle ? '✅' : '❌'}`);

  // 6) 页面 HTML 结构快照
  console.log('\n=== 5) 页面结构 ===');
  const structure = await page.evaluate(() => {
    return {
      bodyClass: document.body.className,
      hasMain: !!document.querySelector('main'),
      hasNav: !!document.querySelector('nav'),
      mainClasses: document.querySelector('main')?.className?.slice(0, 100) || 'none',
    };
  });
  console.log(`   body class: ${structure.bodyClass}`);
  console.log(`   main: ${structure.hasMain ? '✅' : '❌'}`);
  console.log(`   main classes: ${structure.mainClasses}`);

  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} 控制台错误:`);
    errors.forEach(e => console.log(`   ${e.slice(0, 200)}`));
  } else {
    console.log('\n✅ 无控制台错误');
  }

  await browser.close();
  console.log('\nDone');
})();

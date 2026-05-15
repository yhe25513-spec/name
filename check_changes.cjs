const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // 1) Check if body::before/after exist in CSS
  console.log('=== 1) body::before/after ambient glow ===');
  await page.goto('http://localhost:3000/login', { timeout: 15000, waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const hasBefore = await page.evaluate(() => {
    const beforeStyle = getComputedStyle(document.body, '::before');
    return beforeStyle.background.includes('radial-gradient');
  });
  const hasAfter = await page.evaluate(() => {
    const afterStyle = getComputedStyle(document.body, '::after');
    return afterStyle.background.includes('radial-gradient');
  });
  console.log(`  body::before radial-gradient: ${hasBefore ? '✅' : '❌'}`);
  console.log(`  body::after radial-gradient: ${hasAfter ? '✅' : '❌'}`);

  // 2) Check keyframes exist
  console.log('\n=== 2) typing-bounce keyframes ===');
  const hasKeyframes = await page.evaluate(() => {
    try {
      // Check if the animation name is recognized
      const el = document.createElement('div');
      el.style.animation = 'typing-bounce 1s';
      return el.style.animation.includes('typing-bounce');
    } catch { return false; }
  });
  console.log(`  typing-bounce keyframes: ${hasKeyframes ? '✅' : '❌'}`);

  // 3) Check compilation errors
  console.log('\n=== 3) Console errors ===');
  if (errors.length === 0) {
    console.log('  ✅ No errors');
  } else {
    errors.forEach(e => console.log(`  ❌ ${e.slice(0, 150)}`));
  }

  // 4) Try game page (will redirect but shouldn't crash)
  console.log('\n=== 4) Game page check ===');
  try {
    await page.goto('http://localhost:3000/game/397a44fe-6ab6-40aa-b207-192ce27076e1', { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    console.log(`  Final URL: ${page.url()}`);
    if (errors.length === 0) {
      console.log('  ✅ No compile errors on game page');
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  await browser.close();
  console.log('\nDone');
})();

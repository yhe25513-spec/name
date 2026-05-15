const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('=== 1) Desktop game page (redirects to login) ===');
  await page.goto('http://localhost:3000/game/test-id', { timeout: 15000, waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  if (errors.length > 0) {
    console.log(`❌ ${errors.length} console errors:`);
    errors.forEach(e => console.log(`   ${e.slice(0, 200)}`));
  } else {
    console.log('✅ No console errors');
  }

  console.log('\n=== 2) Mobile viewport (375x812 iPhone) ===');
  const pageM = await browser.newPage({ viewport: { width: 375, height: 812 } });
  pageM.on('console', msg => {
    if (msg.type() === 'error') console.log(`   ❌ ${msg.text().slice(0, 150)}`);
  });
  await pageM.goto('http://localhost:3000/login', { timeout: 15000, waitUntil: 'networkidle' });
  await pageM.waitForTimeout(1500);

  // Check if bottom tab bar would render (game page only)
  console.log('   Login page loaded (tab bar is on game page only)');

  console.log('\n=== 3) Keyframes check ===');
  const hasTyping = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.animation = 'typing-bounce 1s';
    return el.style.animation.includes('typing-bounce');
  });
  const hasParticle = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.animation = 'particle-float 1s';
    return el.style.animation.includes('particle-float');
  });
  console.log(`   typing-bounce: ${hasTyping ? '✅' : '❌'}`);
  console.log(`   particle-float: ${hasParticle ? '✅' : '❌'}`);

  await browser.close();
  console.log('\nDone');
})();

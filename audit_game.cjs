const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const gameUrl = 'http://localhost:3000/game/397a44fe-6ab6-40aa-b207-192ce27076e1';
  console.log(`Loading: ${gameUrl}`);

  try {
    await page.goto(gameUrl, { timeout: 20000, waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for theme + content

    console.log(`  URL after load: ${page.url()}`);
    console.log(`  Title: ${await page.title()}`);

    // 1) Check theme CSS variables on root element
    const vars = await page.evaluate(() => {
      const el = document.querySelector('[style*="--bg-primary"]');
      if (!el) return null;
      const s = el.getAttribute('style');
      return {
        hasBgPrimary: s.includes('--bg-primary'),
        hasAccent: s.includes('--accent'),
        hasGlass: s.includes('--glass'),
        hasGlow: s.includes('--glow'),
        elementTag: el.tagName,
        elementClass: el.className?.slice(0, 60),
      };
    });
    console.log(`  Theme root element: ${JSON.stringify(vars)}`);

    // 2) Count glass panels (backdrop-filter)
    const glassCount = await page.evaluate(() => {
      let count = 0;
      const all = document.querySelectorAll('*');
      all.forEach(el => {
        const s = getComputedStyle(el);
        if (s.backdropFilter && s.backdropFilter !== 'none') count++;
      });
      return count;
    });
    console.log(`  Glass backdrop-filter elements: ${glassCount}`);

    // 3) Check atmosphere glow layers
    const glowLayers = await page.evaluate(() => {
      const layers = [];
      const all = document.querySelectorAll('*');
      all.forEach(el => {
        const s = getComputedStyle(el);
        if (s.background && s.background.includes('radial-gradient') && !s.background.includes('url(')) {
          layers.push(el.tagName + (el.className ? '.' + el.className.slice(0, 40) : ''));
        }
      });
      return layers.slice(0, 6);
    });
    console.log(`  Radial-gradient elements: ${glowLayers.length}`);

    // 4) Check option buttons (should have glow)
    const btnStyles = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      const results = [];
      btns.forEach(b => {
        const s = getComputedStyle(b);
        if (s.boxShadow && s.boxShadow.includes('rgb')) {
          results.push({
            text: b.textContent?.trim().slice(0, 50),
            boxShadow: s.boxShadow.slice(0, 100),
            background: s.background.slice(0, 80),
            border: s.border.slice(0, 60),
          });
        }
      });
      return results.slice(0, 8);
    });
    console.log('\n  Button styles (first 8 with shadow):');
    btnStyles.forEach(b => {
      console.log(`    [${b.text?.slice(0, 30)}]`);
      console.log(`      bg: ${b.background?.slice(0, 60)}`);
      console.log(`      shadow: ${b.boxShadow?.slice(0, 60)}`);
      console.log(`      border: ${b.border?.slice(0, 40)}`);
    });

    // 5) Check HP bar uses gradient
    const hpBars = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const results = [];
      all.forEach(el => {
        const s = getComputedStyle(el);
        const w = s.width;
        const h = s.height;
        // Find small bars (height < 10px, width > some %)
        const hNum = parseFloat(h);
        const wNum = parseFloat(w);
        if (hNum > 1 && hNum < 12 && wNum > 20 && s.background && s.background.includes('gradient')) {
          results.push({
            width: w,
            height: h,
            background: s.background.slice(0, 80),
          });
        }
      });
      return results.slice(0, 5);
    });
    console.log('\n  HP-like bars (gradient, 1-12px height):');
    hpBars.forEach(b => console.log(`    ${b.width}×${b.height} — ${b.background?.slice(0, 60)}`));

    // 6) Check for any JS console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    // Re-navigate to trigger errors
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    if (errors.length > 0) {
      console.log(`\n  ⚠ Console errors: ${errors.length}`);
      errors.slice(0, 5).forEach(e => console.log(`    ${e.slice(0, 150)}`));
    } else {
      console.log('\n  ✅ No console errors');
    }

    // Screenshot
    await page.screenshot({
      path: 'C:\\Users\\ZhuanZ\\Desktop\\game\\screenshots\\game-page.png',
      fullPage: true
    });
    console.log('\n  Screenshot: game-page.png');

  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  await browser.close();
  console.log('\n✅ Audit done');
})();

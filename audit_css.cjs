const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const checkPage = async (name, path) => {
    console.log(`\n=== ${name} (${path}) ===`);
    try {
      await page.goto(`http://localhost:3000${path}`, { timeout: 15000, waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Check background color
      const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      console.log(`  body bg: ${bgColor}`);

      // Check CSS custom properties on documentElement
      const cssVars = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
          '--bg-primary': style.getPropertyValue('--bg-primary').trim(),
          '--bg-main': style.getPropertyValue('--bg-main').trim(),
          '--bg-panel': style.getPropertyValue('--bg-panel').trim(),
          '--accent': style.getPropertyValue('--accent').trim(),
          '--accent2': style.getPropertyValue('--accent2').trim(),
          '--danger': style.getPropertyValue('--danger').trim(),
          '--warning': style.getPropertyValue('--warning').trim(),
          '--glow': style.getPropertyValue('--glow').trim(),
          '--shadow': style.getPropertyValue('--shadow').trim(),
          '--btn-glow': style.getPropertyValue('--btn-glow').trim(),
          '--glass-bg': style.getPropertyValue('--glass-bg').trim(),
          '--glass-blur': style.getPropertyValue('--glass-blur').trim(),
          '--glow-accent': style.getPropertyValue('--glow-accent').trim(),
          '--hp-bar-fill': style.getPropertyValue('--hp-bar-fill').trim(),
        };
      });

      console.log('  CSS Variables:');
      for (const [key, val] of Object.entries(cssVars)) {
        const marker = val ? '✅' : '❌';
        console.log(`    ${marker} ${key}: ${val || '(empty)'}`);
      }

      // Check if body has the expected dark bg
      const isDarkBg = bgColor === 'rgb(7, 11, 20)' || bgColor.includes('7, 11, 20');
      console.log(`  Dark bg match: ${isDarkBg ? '✅ YES' : '❌ NO — got: ' + bgColor}`);

      // Check for glass panels
      const glassElements = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        const glass = [];
        all.forEach(el => {
          const style = getComputedStyle(el);
          if (style.backdropFilter && style.backdropFilter !== 'none') {
            glass.push(el.tagName + (el.className ? '.' + el.className.slice(0, 40) : ''));
          }
        });
        return glass.slice(0, 8);
      });
      console.log(`  Glass (backdrop-filter) elements: ${glassElements.length}`);
      glassElements.forEach(el => console.log(`    - ${el}`));

      // Console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      return { cssVars, isDarkBg };
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
      return null;
    }
  };

  await checkPage('Homepage', '/');
  await checkPage('Login', '/login');
  await checkPage('Game List', '/game');
  await checkPage('Create', '/create');

  await browser.close();
  console.log('\n✅ Audit complete');
})();

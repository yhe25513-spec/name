const { chromium } = require('playwright');
const { mkdirSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

(async () => {
  const outDir = join(homedir(), 'Desktop/game/screenshots');
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [CONSOLE ERROR]', msg.text());
  });

  const pages = [
    { name: '01-homepage', path: '/' },
    { name: '02-login', path: '/login' },
    { name: '03-game-list', path: '/game' },
    { name: '04-create', path: '/create' },
  ];

  for (const p of pages) {
    console.log(`Loading ${p.path}...`);
    try {
      await page.goto(`http://localhost:3000${p.path}`, { timeout: 15000, waitUntil: 'networkidle' });
      await page.screenshot({ path: join(outDir, `${p.name}.png`), fullPage: true });
      console.log(`  Saved: ${p.name}.png`);
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots in:', outDir);
})();

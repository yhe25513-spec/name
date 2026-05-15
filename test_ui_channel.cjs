const { chromium } = require('playwright');
const { mkdirSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

(async () => {
  const outDir = join(homedir(), 'Desktop/game/screenshots');
  mkdirSync(outDir, { recursive: true });

  // Try system Chrome / Edge / Chromium
  let browser;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      const opts = { headless: true, timeout: 30000 };
      if (channel) {
        opts.channel = channel;
        console.log(`Trying channel: ${channel}...`);
      } else {
        console.log('Trying default Chromium...');
      }
      browser = await chromium.launch(opts);
      console.log('  OK!');
      break;
    } catch {
      console.log('  Not available');
    }
  }

  if (!browser) {
    console.log('ERROR: No browser available');
    process.exit(1);
  }

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
      await page.goto(`http://localhost:3000${p.path}`, { timeout: 20000, waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(outDir, `${p.name}.png`), fullPage: true });
      console.log(`  Saved: ${p.name}.png`);
    } catch (e) {
      console.log(`  Failed: ${e.message.slice(0, 100)}`);
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots in:', outDir);
})();

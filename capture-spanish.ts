import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const EDITOR_URL = 'http://localhost:5199';
const SCREENSHOTS_DIR = join(process.cwd(), 'screenshots-spanish');

async function captureWithSpanish() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  // Fresh context with no cache
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    locale: 'es-ES',
  });
  
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  try {
    await page.goto(EDITOR_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✓ Page loaded');
    
    // Force Spanish via localStorage
    await page.evaluate(() => {
      localStorage.setItem('cc.locale', 'es');
    });
    console.log('✓ Set Spanish locale');
    
    // Reload to apply
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('✓ Reloaded with Spanish');
    
    // Check what's showing
    const text = await page.evaluate(() => {
      const texts: string[] = [];
      document.querySelectorAll('span, button, div').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 0 && text.length < 50) {
          texts.push(text);
        }
      });
      return texts.slice(0, 30);
    });
    
    console.log('\nVisible text samples:',JSON.stringify(text, null, 2));
    
    // Take screenshots
    const shot1 = await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'dashboard-spanish.png'),
      fullPage: true,
    });
    console.log(`\n✓ Screenshot: ${(shot1.length / 1024).toFixed(1)} KB`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

captureWithSpanish();

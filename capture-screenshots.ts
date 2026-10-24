import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const EDITOR_URL = 'http://localhost:5199';
const SCREENSHOTS_DIR = join(process.cwd(), 'screenshots');

async function captureScreenshots() {
  // Create screenshots directory
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  
  const page = await context.newPage();
  
  console.log(`Navigating to ${EDITOR_URL}...`);
  await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait for the editor to load
  console.log('Waiting for editor to load...');
  await page.waitForTimeout(8000);
  
  // Screenshot 1: Main editor overview
  console.log('Capturing main editor view...');
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '01-editor-overview.png'),
    fullPage: false,
  });
  
  // Wait a bit between screenshots
  await page.waitForTimeout(2000);
  
  // Screenshot 2: Timeline close-up (if visible)
  console.log('Capturing timeline view...');
  const timeline = await page.locator('.cc-editor-shell').first();
  if (await timeline.isVisible()) {
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, '02-timeline-view.png'),
      fullPage: false,
    });
  }
  
  await page.waitForTimeout(2000);
  
  // Screenshot 3: Full page
  console.log('Capturing full editor layout...');
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '03-full-editor.png'),
    fullPage: true,
  });
  
  // Screenshot 4: Try to capture with library panel visible
  console.log('Capturing with panels...');
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, '04-editor-with-panels.png'),
    fullPage: false,
  });
  
  console.log('Screenshots captured successfully!');
  console.log(`Saved to: ${SCREENSHOTS_DIR}`);
  
  await browser.close();
  
  console.log('\nScreenshots:');
  console.log('1. 01-editor-overview.png - Main editor view');
  console.log('2. 02-timeline-view.png - Timeline focused');
  console.log('3. 03-full-editor.png - Full layout');
  console.log('4. 04-editor-with-panels.png - With all panels');
}

captureScreenshots().catch((error) => {
  console.error('Error capturing screenshots:', error);
  process.exit(1);
});

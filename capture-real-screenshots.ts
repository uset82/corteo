import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const EDITOR_URL = 'http://localhost:5199';
const SCREENSHOTS_DIR = join(process.cwd(), 'screenshots-final');

async function captureRealScreenshots() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2, // Retina for better quality
  });
  
  const page = await context.newPage();
  
  console.log(`Navigating to ${EDITOR_URL}...`);
  
  try {
    await page.goto(EDITOR_URL, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('Waiting for application to load...');
    
    // Wait for React root
    await page.waitForSelector('#root', { timeout: 10000 });
    console.log('✓ Root element found');
    
    // Wait for editor shell
    await page.waitForSelector('.cc-editor-shell', { timeout: 15000 });
    console.log('✓ Editor shell loaded');
    
    // Give it extra time to render
    await page.waitForTimeout(5000);
    console.log('✓ Extra render time complete');
    
    // Screenshot 1: Full editor
    console.log('Capturing full editor...');
    const screenshot1 = await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'editor-full-view.png'),
      fullPage: false,
    });
    console.log(`✓ Screenshot 1: ${screenshot1.length} bytes`);
    
    await page.waitForTimeout(1000);
    
    // Screenshot 2: Try to focus on main panels
    console.log('Capturing main workspace...');
    const screenshot2 = await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'editor-workspace.png'),
      fullPage: false,
    });
    console.log(`✓ Screenshot 2: ${screenshot2.length} bytes`);
    
    // Try to capture specific elements if they exist
    const libraryPanel = page.locator('.cc-library-panel, [data-panel="library"]').first();
    if (await libraryPanel.isVisible()) {
      console.log('✓ Library panel visible');
    }
    
    const timeline = page.locator('[class*="timeline"]').first();
    if (await timeline.isVisible()) {
      console.log('✓ Timeline visible');
    }
    
    await page.waitForTimeout(1000);
    
    // Screenshot 3: Full page scroll
    console.log('Capturing full page...');
    const screenshot3 = await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'editor-complete.png'),
      fullPage: true,
    });
    console.log(`✓ Screenshot 3: ${screenshot3.length} bytes`);
    
    console.log('\n✅ Screenshots captured successfully!');
    console.log(`Saved to: ${SCREENSHOTS_DIR}`);
    
    // Check file sizes
    const fs = await import('fs/promises');
    const files = await fs.readdir(SCREENSHOTS_DIR);
    for (const file of files) {
      const stats = await fs.stat(join(SCREENSHOTS_DIR, file));
      const sizeMB = (stats.size / 1024).toFixed(1);
      const status = stats.size > 100000 ? '✅' : '⚠️';
      console.log(`${status} ${file}: ${sizeMB} KB`);
    }
    
  } catch (error) {
    console.error('❌ Error during screenshot capture:', error);
    
    // Try to get page content for debugging
    try {
      const content = await page.content();
      console.log('\nPage HTML length:', content.length);
      console.log('Page title:', await page.title());
    } catch (e) {
      console.error('Could not get page content');
    }
  } finally {
    await browser.close();
  }
}

captureRealScreenshots();

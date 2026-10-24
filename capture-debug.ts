import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const EDITOR_URL = 'http://localhost:5199';
const SCREENSHOTS_DIR = join(process.cwd(), 'screenshots-debug');

async function debugScreenshots() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  
  const page = await context.newPage();
  
  // Capture console logs
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));
  
  try {
    await page.goto(EDITOR_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('✓ Page loaded');
    
    // Wait a bit for React to render
    await page.waitForTimeout(3000);
    
    // Get page structure
    const structure = await page.evaluate(() => {
      const root = document.getElementById('root');
      if (!root) return { error: 'No root element' };
      
      return {
        rootHTML: root.innerHTML.substring(0, 500),
        rootClasses: root.className,
        childCount: root.children.length,
        firstChildTag: root.children[0]?.tagName,
        firstChildClasses: root.children[0]?.className,
        bodyClasses: document.body.className,
        scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean),
      };
    });
    
    console.log('\nPage Structure:', JSON.stringify(structure, null, 2));
    
    // Save HTML for inspection
    const html = await page.content();
    await writeFile(join(SCREENSHOTS_DIR, 'page.html'), html);
    console.log(`✓ Saved HTML (${html.length} bytes)`);
    
    // Take screenshots
    const shot1 = await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'fullpage.png'),
      fullPage: true,
    });
    console.log(`✓ Screenshot 1: ${(shot1.length / 1024).toFixed(1)} KB`);
    
    const shot2 = await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'viewport.png'),
      fullPage: false,
    });
    console.log(`✓ Screenshot 2: ${(shot2.length / 1024).toFixed(1)} KB`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugScreenshots();

import puppeteer from 'puppeteer-core';

(async () => {
  const browserURL = 'http://127.0.0.1:9222';
  try {
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    
    // Find the Vehicle Details page
    const page = pages.find(p => p.url().includes('/admin/vehicles/'));
    if (!page) {
      console.log('Vehicle details page not found');
      browser.disconnect();
      return;
    }
    
    console.log('Found page:', page.url());
    
    // Listen to console and network
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('requestfailed', request => {
      console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
    });
    page.on('response', response => {
      if (response.url().includes('/documents/')) {
        console.log('RESPONSE:', response.status(), response.url());
      }
    });

    // Bring page to front
    await page.bringToFront();
    
    // Find all delete buttons
    const deleteButtons = await page.$$('button[title="Delete"]');
    console.log(`Found ${deleteButtons.length} delete buttons`);
    
    if (deleteButtons.length > 0) {
      // Click the first one
      console.log('Clicking the first delete button...');
      
      // Override window.confirm to always return true
      await page.evaluate(() => {
        window.confirm = () => true;
      });
      
      await deleteButtons[0].click();
      
      // Wait for a bit
      await new Promise(r => setTimeout(r, 2000));
    }
    
    browser.disconnect();
  } catch (err) {
    console.log('Puppeteer error:', err);
  }
})();

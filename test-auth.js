import puppeteer from 'puppeteer-core';

(async () => {
  const browserURL = 'http://127.0.0.1:9222';
  try {
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('/admin/vehicles/'));
    
    if (!page) {
      process.exit(1);
    }
    
    const userRole = await page.evaluate(() => {
      // Find what role they have by inspecting localStorage or React context if possible
      const rawUser = localStorage.getItem('gsk_user');
      return rawUser ? JSON.parse(rawUser).role : 'unknown';
    });
    
    const hasDeleteBtns = await page.evaluate(() => document.querySelectorAll('button[title="Delete"]').length);

    console.log('User Role:', userRole);
    console.log('Delete Buttons Count:', hasDeleteBtns);
    
    browser.disconnect();
  } catch (err) {
    console.log('Error:', err);
  }
})();

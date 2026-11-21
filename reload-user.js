import puppeteer from 'puppeteer-core';

(async () => {
  const browserURL = 'http://127.0.0.1:9222';
  try {
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('/admin/vehicles/'));
    
    if (page) {
      console.log('Reloading page:', page.url());
      await page.reload({ waitUntil: 'networkidle0' });
      console.log('Page reloaded');
    }
    
    browser.disconnect();
  } catch (err) {
    console.log('Error:', err);
  }
})();

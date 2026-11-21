import puppeteer from 'puppeteer-core';

(async () => {
  const browserURL = 'http://127.0.0.1:9222';
  try {
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    for (const page of pages) {
      if (page.url().includes('cloudinary.com')) {
        console.log('Found Cloudinary page:', page.url());
        const text = await page.evaluate(() => document.body.innerText);
        console.log('Page Text:', text);
        
        // Take a screenshot
        await page.screenshot({ path: 'cloudinary_user_error.png' });
        console.log('Saved screenshot to cloudinary_user_error.png');
      }
    }
    browser.disconnect();
  } catch (err) {
    console.log('Puppeteer error:', err);
  }
})();

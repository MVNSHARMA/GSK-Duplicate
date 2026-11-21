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
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    
    await page.evaluate(() => {
      window.confirm = () => true;
      const originalFetch = window.fetch;
      window.fetch = function() {
        console.log('FETCH URL:', arguments[0]);
        return originalFetch.apply(this, arguments);
      };
    });

    const result = await page.evaluate(async () => {
      const allDeleteBtns = document.querySelectorAll('button[title="Delete"]');
      if (allDeleteBtns.length === 0) return 'No buttons';
      
      // Click the last one
      allDeleteBtns[allDeleteBtns.length - 1].click();
      return 'Clicked button ' + (allDeleteBtns.length - 1);
    });

    console.log(result);
    
    // Wait for the toast and fetch
    await new Promise(r => setTimeout(r, 2000));

    // Get any toasts
    const toasts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.go3958317564, .go2072408551')).map(el => el.innerText); // generic sonner/hot-toast classes, or just any div with fixed position
    });
    
    // Try catching common toast classes like 'Toastify__toast-body'
    const toastify = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[role="alert"]')).map(el => el.innerText);
    });
    console.log('Toasts (alert role):', toastify);
    
    browser.disconnect();
  } catch (err) {
    console.log('Error:', err);
  }
})();

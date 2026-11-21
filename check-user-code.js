import puppeteer from 'puppeteer-core';

(async () => {
  const browserURL = 'http://127.0.0.1:9222';
  try {
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('/admin/vehicles/'));
    
    // Evaluate a function that triggers handleDelete on an imaginary docId
    // to see if it throws ReferenceError or if it tries to fetch.
    const result = await page.evaluate(async () => {
       try {
           // Find the component's internal function? Hard.
           // Let's just find the delete button and click it, and capture console errors.
       } catch (e) {
           return e.message;
       }
    });
    console.log('Result:', result);
    
    // Wait, let's just trigger a delete click and catch the toast
    page.on('console', msg => console.log('LOG:', msg.text()));
    
    const elements = await page.$$('button[title="Delete"]');
    if (elements.length > 0) {
      // Find the one in the documentation section. The documentation section has an h3 "Vehicle Documentation"
      const docSection = await page.evaluateHandle(() => {
        const headers = Array.from(document.querySelectorAll('h3'));
        const docHeader = headers.find(h => h.innerText.includes('Vehicle Documentation'));
        return docHeader ? docHeader.parentElement : null;
      });
      
      if (docSection) {
        const deleteBtns = await docSection.$$('button[title="Delete"]');
        if (deleteBtns.length > 0) {
           console.log('Found documentation delete button, clicking...');
           // mock fetch to log arguments
           await page.evaluate(() => {
              window.confirm = () => true;
              const originalFetch = window.fetch;
              window.fetch = function() {
                  console.log('FETCH CALLED:', arguments[0], JSON.stringify(arguments[1] || {}));
                  return originalFetch.apply(this, arguments);
              };
           });
           
           await deleteBtns[0].click();
           await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    
    browser.disconnect();
  } catch (err) {
    console.log('Puppeteer error:', err);
  }
})();

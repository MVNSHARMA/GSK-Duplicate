import puppeteer from 'puppeteer-core';

(async () => {
  const browserURL = 'http://127.0.0.1:9222';
  try {
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('/admin/vehicles/'));
    
    if (!page) {
      console.log('No vehicle details page found.');
      process.exit(1);
    }

    console.log('Attaching to page:', page.url());

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    // Override window.confirm so we can delete
    await page.evaluate(() => {
      window.confirm = () => true;
      console.log('window.confirm overridden');
    });

    // Find all delete buttons in the documentation section
    const clicked = await page.evaluate(() => {
      // Find the specific container for Vehicle Documentation
      const headers = Array.from(document.querySelectorAll('h3'));
      const docHeader = headers.find(h => h.innerText.includes('Vehicle Documentation'));
      if (!docHeader) return false;
      
      const docContainer = docHeader.parentElement.parentElement;
      const deleteBtns = docContainer.querySelectorAll('button[title="Delete"]');
      if (deleteBtns.length > 0) {
        console.log('Clicking delete button...');
        deleteBtns[0].click();
        return true;
      }
      return false;
    });

    console.log('Clicked delete button:', clicked);
    
    // Wait for network response
    await new Promise(r => setTimeout(r, 2000));
    browser.disconnect();
  } catch (err) {
    console.log('Error:', err);
  }
})();

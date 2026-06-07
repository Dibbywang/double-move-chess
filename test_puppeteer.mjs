import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:4173');
  
  console.log("Waiting for game to load...");
  await page.waitForSelector('.lucide-user'); // Wait for icons or some element
  
  // Wait a bit for models to load
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Simulating player move e2e4...");
  // Need to find the squares. squares have data-index. e2 is 12, e4 is 28.
  // Wait! A1 is 0? The chessboard maps squares.
  // Actually, I can just evaluate JS in the page to call the engine directly!
  await page.evaluate(async () => {
    try {
      const { search, loadWasmEngine } = await import('/assets/index-BhacNUXi.js'); // The exact chunk might be different
    } catch(e) {
      console.log("evaluate error", e);
    }
  });

  await browser.close();
})();

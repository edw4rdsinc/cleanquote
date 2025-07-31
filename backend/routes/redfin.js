const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

/**
 * POST /redfin - Extract square footage from Redfin property listings
 * 
 * Body parameters:
 * - street: Street address
 * - city: City name
 * - state: State abbreviation
 * - zip: ZIP code
 * 
 * Returns: { squareFootage: number } or error message
 */
app.post('/redfin', async (req, res) => {
  let browser = null;
  
  try {
    // Extract and validate request body
    const { street, city, state, zip } = req.body;
    
    if (!street || !city || !state || !zip) {
      return res.status(400).json({
        error: 'Missing required fields: street, city, state, zip'
      });
    }
    
    // Construct full address for search
    const fullAddress = `${street}, ${city}, ${state} ${zip}`;
    console.log(`Searching for property: ${fullAddress}`);
    
    // Launch Puppeteer browser in headless mode
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set user agent to appear more like a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set 15-second timeout for all navigation
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);
    
    // Navigate to Redfin homepage
    console.log('Navigating to Redfin...');
    await page.goto('https://www.redfin.com', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    // Wait for and find the search input box
    console.log('Looking for search box...');
    await page.waitForSelector('input[data-rf-test-id="search-box-input"], input[placeholder*="Enter an address"], input[name="searchInputBox"]', { timeout: 10000 });
    
    // Enter the address in the search box
    const searchSelector = 'input[data-rf-test-id="search-box-input"], input[placeholder*="Enter an address"], input[name="searchInputBox"]';
    await page.type(searchSelector, fullAddress);
    
    // Submit the search (either click search button or press Enter)
    console.log('Submitting search...');
    try {
      // Try to click search button first
      await page.click('button[data-rf-test-id="search-button"], button[type="submit"]');
    } catch (e) {
      // Fallback: press Enter
      await page.keyboard.press('Enter');
    }
    
    // Wait for search results or property page to load
    console.log('Waiting for results...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    // Check current URL to determine if we're on a direct property listing
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    let squareFootage = null;
    
    // If URL contains '/home/', we're likely on a property detail page
    if (currentUrl.includes('/home/')) {
      console.log('Direct property page detected, extracting square footage...');
      squareFootage = await extractSquareFootage(page);
    } else {
      // We're on search results page, need to click first listing
      console.log('Search results page detected, looking for first listing...');
      
      // Wait for search results to appear
      await page.waitForSelector('div[data-rf-test-id="mapListViewContainer"], .search-result-item, .SearchResultsList', { timeout: 10000 });
      
      // Find and click the first property listing
      const firstListingSelector = [
        'a[data-rf-test-id="property-card-link"]',
        '.search-result-item a',
        '.SearchResultsList a',
        'a[href*="/home/"]'
      ];
      
      let clicked = false;
      for (const selector of firstListingSelector) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          clicked = true;
          console.log(`Clicked first listing using selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
          continue;
        }
      }
      
      if (!clicked) {
        throw new Error('Could not find any property listings to click');
      }
      
      // Wait for property detail page to load
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      
      // Extract square footage from property detail page
      console.log('Extracting square footage from property detail page...');
      squareFootage = await extractSquareFootage(page);
    }
    
    // Return results
    if (squareFootage) {
      console.log(`Found square footage: ${squareFootage}`);
      res.json({ squareFootage: parseInt(squareFootage) });
    } else {
      res.status(404).json({ 
        error: 'Square footage not found on property page',
        address: fullAddress 
      });
    }
    
  } catch (error) {
    console.error('Error scraping Redfin:', error.message);
    
    // Return appropriate error response
    if (error.message.includes('timeout') || error.message.includes('Navigation timeout')) {
      res.status(408).json({ 
        error: 'Request timeout - Redfin took too long to respond',
        details: error.message 
      });
    } else if (error.message.includes('not found') || error.message.includes('Could not find')) {
      res.status(404).json({ 
        error: 'Property not found or page structure changed',
        details: error.message 
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error while scraping Redfin',
        details: error.message 
      });
    }
    
  } finally {
    // Always close browser to prevent memory leaks
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
});

/**
 * Extract square footage from current page using document.body.innerText
 * Looks for patterns like "1,234 sq ft", "1234 sqft", "1,234 Square Feet", etc.
 */
async function extractSquareFootage(page) {
  try {
    const squareFootage = await page.evaluate(() => {
      const text = document.body.innerText;
      
      // Multiple regex patterns to catch different square footage formats
      const patterns = [
        /(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)/i,
        /(\d{1,3}(?:,\d{3})*)\s*sq/i,
        /square\s*footage[:\s]*(\d{1,3}(?:,\d{3})*)/i,
        /(\d{1,3}(?:,\d{3})*)\s*square/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          // Remove commas and return the number
          const sqft = match[1].replace(/,/g, '');
          const num = parseInt(sqft);
          
          // Sanity check: square footage should be reasonable (100-50000 sq ft)
          if (num >= 100 && num <= 50000) {
            return num;
          }
        }
      }
      
      return null;
    });
    
    return squareFootage;
    
  } catch (error) {
    console.error('Error extracting square footage:', error);
    return null;
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Redfin Property Scraper' });
});

/**
 * Error handling middleware
 */
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// Export the app for use in other files or start server directly
module.exports = app;

// Start server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Redfin scraper server running on port ${PORT}`);
    console.log(`POST /redfin - Extract square footage from property addresses`);
    console.log(`GET /health - Health check`);
  });
}

/*
USAGE EXAMPLE:

curl -X POST http://localhost:3000/redfin \
  -H "Content-Type: application/json" \
  -d '{
    "street": "123 Main St",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101"
  }'

EXPECTED RESPONSE:
{
  "squareFootage": 1500
}

ERROR RESPONSES:
- 400: Missing required fields
- 404: Property not found
- 408: Request timeout
- 500: Internal server error

INSTALLATION:
npm install express puppeteer

DEPLOYMENT NOTES:
- Consider using puppeteer-extra-plugin-stealth for better bot detection avoidance
- Add rate limiting to prevent abuse
- Consider using a headless browser service in production (like Browserless.io)
- Monitor Redfin's robots.txt and terms of service
- Add request logging for debugging
- Consider adding retry logic for failed requests
*/
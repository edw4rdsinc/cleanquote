// --- ea4-cleanquote Backend Server ---
// This file contains a mock Express.js server that includes a Puppeteer-based
// web scraper for Redfin, plus mock services for Stripe checkout and
// Google Calendar booking.

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); 
const puppeteer = require('puppeteer'); // Needed for the web scraper

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// --- MOCK Stripe Service ---
const mockStripe = {
  checkout: {
    sessions: {
      create: async (sessionParams) => {
        await new Promise(resolve => setTimeout(resolve, 500)); 
        if (!sessionParams.line_items || sessionParams.line_items.length === 0) {
          throw new Error('Missing line items for Stripe session.');
        }
        const mockSessionId = 'cs_test_mock_12345';
        return {
          url: `https://checkout.stripe.com/c/${mockSessionId}`
        };
      }
    }
  }
};

// --- MOCK Calendar Service ---
const mockCalendar = {
    bookedEvents: [
        { start: new Date(new Date().setHours(10, 0, 0, 0)), end: new Date(new Date().setHours(12, 0, 0, 0)) },
        { start: new Date(new Date().setDate(new Date().getDate() + 1)).setHours(13, 0, 0, 0), end: new Date(new Date().setDate(new Date().getDate() + 1)).setHours(14, 30, 0, 0) }
    ],

    findNextAvailableSlot: (estimatedHours, preferredDate) => {
        const businessHoursStart = 9;
        const businessHoursEnd = 17;
        const workWeek = [1, 2, 3, 4, 5];

        let currentDate = new Date(preferredDate);
        currentDate.setHours(businessHoursStart, 0, 0, 0);

        for (let i = 0; i < 30; i++) {
            const dayOfWeek = currentDate.getDay();
            if (!workWeek.includes(dayOfWeek)) {
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(businessHoursStart, 0, 0, 0);
                continue;
            }
            for (let hour = businessHoursStart; hour < businessHoursEnd; hour++) {
                const slotStart = new Date(currentDate);
                slotStart.setHours(hour, 0, 0, 0);
                const slotEnd = new Date(slotStart);
                slotEnd.setHours(slotEnd.getHours() + estimatedHours);
                if (slotEnd.getHours() <= businessHoursEnd) {
                    let isConflict = false;
                    for (const event of mockCalendar.bookedEvents) {
                        if (slotStart < event.end && slotEnd > event.start) {
                            isConflict = true;
                            break;
                        }
                    }
                    if (!isConflict) {
                        return {
                            status: "booked",
                            startTime: slotStart.toISOString(),
                            endTime: slotEnd.toISOString()
                        };
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(businessHoursStart, 0, 0, 0);
        }
        return null;
    }
};

// --- Puppeteer Scraper Helper Function ---
// This function is moved from the user-provided 'redfin.js'
async function extractSquareFootage(page) {
  try {
    const squareFootage = await page.evaluate(() => {
      const text = document.body.innerText;
      
      const patterns = [
        /(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)/i,
        /(\d{1,3}(?:,\d{3})*)\s*sq/i,
        /square\s*footage[:\s]*(\d{1,3}(?:,\d{3})*)/i,
        /(\d{1,3}(?:,\d{3})*)\s*square/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const sqft = match[1].replace(/,/g, '');
          const num = parseInt(sqft);
          
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

// --- NEW Backend Route: Redfin Property Lookup with Puppeteer Scraper ---
// This code is based on the user-provided 'redfin.js' file.
app.post('/redfin', async (req, res) => {
  let browser = null;
  
  try {
    const { street, city, state, zip } = req.body;
    
    if (!street || !city || !state || !zip) {
      return res.status(400).json({
        error: 'Missing required fields: street, city, state, zip'
      });
    }
    
    const fullAddress = `${street}, ${city}, ${state} ${zip}`;
    console.log(`Searching for property: ${fullAddress}`);
    
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
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);
    
    console.log('Navigating to Redfin...');
    await page.goto('https://www.redfin.com', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    console.log('Looking for search box...');
    await page.waitForSelector('input[data-rf-test-id="search-box-input"], input[placeholder*="Enter an address"], input[name="searchInputBox"]', { timeout: 10000 });
    
    const searchSelector = 'input[data-rf-test-id="search-box-input"], input[placeholder*="Enter an address"], input[name="searchInputBox"]';
    await page.type(searchSelector, fullAddress);
    
    console.log('Submitting search...');
    try {
      await page.click('button[data-rf-test-id="search-button"], button[type="submit"]');
    } catch (e) {
      await page.keyboard.press('Enter');
    }
    
    console.log('Waiting for results...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    let squareFootage = null;
    
    if (currentUrl.includes('/home/')) {
      console.log('Direct property page detected, extracting square footage...');
      squareFootage = await extractSquareFootage(page);
    } else {
      console.log('Search results page detected, looking for first listing...');
      
      await page.waitForSelector('div[data-rf-test-id="mapListViewContainer"], .search-result-item, .SearchResultsList', { timeout: 10000 });
      
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
      
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      
      console.log('Extracting square footage from property detail page...');
      squareFootage = await extractSquareFootage(page);
    }
    
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
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
});

// --- Backend Route: Create Stripe Checkout Session ---
app.post('/stripe/create-checkout', async (req, res) => {
  console.log('Received request to create Stripe checkout session.');
  
  const { name, email, address, totalPrice, depositAmount } = req.body;
  if (!name || !email || !address || !depositAmount) {
    return res.status(400).json({ error: 'Missing required fields for checkout.' });
  }

  try {
    const session = await mockStripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Home Cleaning Deposit – CleanQuote',
            },
            unit_amount: Math.round(depositAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://cleanquote.vercel.app/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://cleanquote.vercel.app/cancel',
      customer_email: email,
      metadata: {
        customer_name: name,
        customer_address: address,
        total_price: totalPrice,
      },
    });
    console.log('Successfully created mock Stripe session. Redirecting...');
    res.status(200).json({ checkout_url: session.url });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error.message);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

// --- Backend Route: Book a Calendar Appointment ---
app.post('/calendar/book', async (req, res) => {
    console.log('Received request to book a calendar appointment.');
    const { name, email, address, estimatedHours, preferredStartDate } = req.body;
    if (!name || !email || !address || !estimatedHours) {
        return res.status(400).json({ error: 'Missing required fields for booking.' });
    }

    try {
        const bookingResult = mockCalendar.findNextAvailableSlot(estimatedHours, preferredStartDate);
        if (bookingResult) {
            console.log('Successfully booked mock calendar event:', bookingResult);
            res.status(200).json(bookingResult);
        } else {
            console.error('No available slot found for the booking request.');
            res.status(404).json({ error: 'No available time slot could be found.' });
        }
    } catch (error) {
        console.error('Error booking calendar event:', error.message);
        res.status(500).json({ error: 'Failed to book calendar event.' });
    }
});

// --- Health check endpoint ---
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

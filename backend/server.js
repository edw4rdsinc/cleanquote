// --- ea4-cleanquote Backend Server ---
// This file runs the Express server, serving both the frontend files and
// handling the API routes.

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); 
const axios = require('axios');
const path = require('path');

const app = express();
// Change the port to something that is less likely to be in use.
const port = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// --- Serve Frontend Files ---
// This middleware serves all files (e.g., CSS, JS) from the 'frontend' directory.
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Debug RentCast API - Let's try multiple approaches ---
const realEstateAPI = {
    apiKey: process.env.RENTCAST_API_KEY || "671796af0835434297f1c016b70353a1",

    // Method 1: Try the city/state approach from their example
    testMethod1: async (address) => {
        try {
            console.log('\n=== METHOD 1: City/State query ===');
            const apiUrl = `https://api.rentcast.io/v1/properties`;
            
            const params = new URLSearchParams({
                city: address.city,
                state: address.state,
                limit: 10
            });

            const headers = {
                'X-Api-Key': realEstateAPI.apiKey,
                'Accept': 'application/json'
            };
            
            const requestUrl = `${apiUrl}?${params.toString()}`;
            console.log('Request URL:', requestUrl);
            
            const response = await axios.get(requestUrl, { headers });
            console.log('SUCCESS - Status:', response.status);
            console.log('Response length:', response.data?.length || 'not array');
            
            return response.data;
        } catch (error) {
            console.log('METHOD 1 FAILED:', error.response?.status, error.response?.data);
            return null;
        }
    },

    // Method 2: Try with full address parameter
    testMethod2: async (address) => {
        try {
            console.log('\n=== METHOD 2: Full address query ===');
            const apiUrl = `https://api.rentcast.io/v1/properties`;
            
            const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
            const params = new URLSearchParams({
                address: fullAddress
            });

            const headers = {
                'X-Api-Key': realEstateAPI.apiKey,
                'Accept': 'application/json'
            };
            
            const requestUrl = `${apiUrl}?${params.toString()}`;
            console.log('Request URL:', requestUrl);
            
            const response = await axios.get(requestUrl, { headers });
            console.log('SUCCESS - Status:', response.status);
            console.log('Response length:', response.data?.length || 'not array');
            
            return response.data;
        } catch (error) {
            console.log('METHOD 2 FAILED:', error.response?.status, error.response?.data);
            return null;
        }
    },

    // Method 3: Try individual address components
    testMethod3: async (address) => {
        try {
            console.log('\n=== METHOD 3: Individual components ===');
            const apiUrl = `https://api.rentcast.io/v1/properties`;
            
            const params = new URLSearchParams({
                street: address.street,
                city: address.city,
                state: address.state,
                zipCode: address.zip,
                limit: 5
            });

            const headers = {
                'X-Api-Key': realEstateAPI.apiKey,
                'Accept': 'application/json'
            };
            
            const requestUrl = `${apiUrl}?${params.toString()}`;
            console.log('Request URL:', requestUrl);
            
            const response = await axios.get(requestUrl, { headers });
            console.log('SUCCESS - Status:', response.status);
            console.log('Response length:', response.data?.length || 'not array');
            
            return response.data;
        } catch (error) {
            console.log('METHOD 3 FAILED:', error.response?.status, error.response?.data);
            return null;
        }
    },

    // Method 4: Test the API key with their documented example
    testApiKey: async () => {
        try {
            console.log('\n=== METHOD 4: API Key test with Austin, TX ===');
            const apiUrl = `https://api.rentcast.io/v1/properties`;
            
            const params = new URLSearchParams({
                city: 'Austin',
                state: 'TX',
                limit: 1
            });

            const headers = {
                'X-Api-Key': realEstateAPI.apiKey,
                'Accept': 'application/json'
            };
            
            const requestUrl = `${apiUrl}?${params.toString()}`;
            console.log('Request URL:', requestUrl);
            
            const response = await axios.get(requestUrl, { headers });
            console.log('API KEY WORKS! - Status:', response.status);
            console.log('Response length:', response.data?.length || 'not array');
            
            return response.data;
        } catch (error) {
            console.log('API KEY TEST FAILED:', error.response?.status, error.response?.data);
            return null;
        }
    },

    lookupProperty: async (address) => {
        console.log('\n=================== DEBUGGING RENTCAST API ===================');
        
        // First test if the API key works at all
        const keyTest = await realEstateAPI.testApiKey();
        if (!keyTest) {
            console.log('❌ API key test failed - there may be an issue with your API key or subscription');
            return { error: true, message: 'API key validation failed' };
        }
        
        console.log('✅ API key works! Trying different search methods...');
        
        // Try method 1: City/State (most likely to work)
        const result1 = await realEstateAPI.testMethod1(address);
        if (result1 && result1.length > 0) {
            console.log('✅ METHOD 1 SUCCESS - Found properties with city/state search');
            // Look for the specific address in results
            const targetProperty = result1.find(prop => 
                prop.formattedAddress && 
                prop.formattedAddress.toLowerCase().includes(address.street.toLowerCase())
            );
            if (targetProperty && targetProperty.squareFootage) {
                return { squareFootage: targetProperty.squareFootage };
            }
        }
        
        // Try method 2: Full address
        const result2 = await realEstateAPI.testMethod2(address);
        if (result2 && result2.length > 0) {
            console.log('✅ METHOD 2 SUCCESS - Found properties with full address search');
            if (result2[0].squareFootage) {
                return { squareFootage: result2[0].squareFootage };
            }
        }
        
        // Try method 3: Individual components
        const result3 = await realEstateAPI.testMethod3(address);
        if (result3 && result3.length > 0) {
            console.log('✅ METHOD 3 SUCCESS - Found properties with component search');
            if (result3[0].squareFootage) {
                return { squareFootage: result3[0].squareFootage };
            }
        }
        
        console.log('❌ All methods tried, no square footage found');
        return null;
    }
};

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

// --- Backend Route: Property Lookup with API (UPDATED) ---
app.post('/property-lookup', async (req, res) => {
    console.log('Received request to lookup property with API.');
    console.log('Request body:', req.body);
    
    const address = req.body;

    if (!address.street || !address.city || !address.state || !address.zip) {
        console.log('Missing required fields:', address);
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const propertyData = await realEstateAPI.lookupProperty(address);
        
        // Check if this is an error response
        if (propertyData && propertyData.error) {
            console.log(`API returned error for: ${address.street}`, propertyData);
            return res.status(500).json({ 
                error: 'API lookup failed', 
                details: propertyData.message,
                status: propertyData.status 
            });
        }
        
        if (propertyData && propertyData.squareFootage) {
            console.log(`Property data found via API for: ${address.street}`, propertyData);
            res.status(200).json(propertyData);
        } else {
            console.log(`Property not found via API for: ${address.street}`);
            res.status(404).json({ error: 'Property not found via API lookup' });
        }
    } catch (error) {
        console.error('API lookup error:', error.message);
        res.status(500).json({ error: 'Failed to perform API property lookup' });
    }
});

// --- Backend Route: Create Stripe Checkout Session ---
app.post('/stripe/create-checkout', async (req, res) => {
  console.log('Received request to create Stripe checkout session.');
  
  const { name, email, address, totalPrice, depositAmount } = req.body;
  if (!name || !email || !address || !depositAmount) {
    return res.status(400).json({ error: 'Missing required fields' });
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
        return res.status(400).json({ error: 'Missing required fields' });
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
  res.json({ status: 'OK', service: 'Real Estate API Lookup' });
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

// --- Explicitly serve index.html for the root URL ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Start server if this file is run directly
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running with API lookup on port ${port}`);
    console.log(`To access the application, open your browser and go to: http://localhost:${port}`);
    console.log(`POST /property-lookup - Extract square footage from property addresses`);
    console.log(`GET /health - Health check`);
  });
}

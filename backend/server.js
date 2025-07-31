// --- ea4-cleanquote Backend Server ---
// This file contains a mock Express.js server that simulates a RentCast API
// lookup, plus mock services for Stripe checkout and Google Calendar booking.

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); 
const axios = require('axios'); // You'll need to install this with npm install axios

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// --- RentCast API Service (Real Implementation) ---
const realEstateAPI = {
    // IMPORTANT: Replace "YOUR_RENTCAST_API_KEY" with your actual API key.
    // In a real application, you would load this from an environment variable
    // for security, like: process.env.RENTCAST_API_KEY;
    apiKey: "671796af0835434297f1c016b70353a1",

    lookupProperty: async (address) => {
        try {
            console.log(`Making real RentCast API call for property: ${address.street}`);
            
            const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
            const apiUrl = `https://api.rentcast.io/v1/properties/search`;

            const requestBody = {
                // The API's request format for searching properties
                address: fullAddress
            };

            const headers = {
                'X-API-KEY': realEstateAPI.apiKey,
                'Content-Type': 'application/json'
            };
            
            // Making the actual API call using axios
            // We'll replace the mock data with this real call.
            const response = await axios.post(apiUrl, requestBody, { headers });
            
            // Assuming the API returns an array of properties, we take the first one.
            const property = response.data[0];

            if (property && property.squareFootage) {
                // Return the square footage if found
                return { squareFootage: property.squareFootage };
            } else {
                return null;
            }

        } catch (error) {
            // Log the full error to help with debugging
            console.error('RentCast API lookup error:', error.response?.data || error.message);
            // In a real application, you might want to return an error object.
            return null;
        }
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

// --- Backend Route: Redfin Property Lookup with API ---
app.post('/redfin', async (req, res) => {
    console.log('Received request to lookup property with API.');
    const address = req.body;

    if (!address.street || !address.city || !address.state || !address.zip) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const propertyData = await realEstateAPI.lookupProperty(address);
        if (propertyData) {
            console.log(`Property data found via API for: ${address.street}`);
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

// Export the app for use in other files or start server directly
module.exports = app;

// Start server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running with API lookup on port ${PORT}`);
    console.log(`POST /redfin - Extract square footage from property addresses`);
    console.log(`GET /health - Health check`);
  });
}


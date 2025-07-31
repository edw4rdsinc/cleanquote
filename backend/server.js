// --- ea4-cleanquote Backend Server ---
// This file contains a mock Express.js server that simulates the Redfin lookup,
// Stripe checkout, and Google Calendar booking processes.

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); 

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// --- MOCK Redfin Service ---
// This is a mock data set to simulate a property lookup service.
const mockPropertyData = {
    "123 Main St, Portland, OR, 97229": { squareFootage: 2150 },
    "456 Oak Ave, Beaverton, OR, 97005": { squareFootage: 1800 },
    "789 Maple Dr, Hillsboro, OR, 97123": { squareFootage: 2500 }
};

// --- MOCK Stripe Service ---
// In a real application, you would initialize the official Stripe library here.
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

// --- NEW Backend Route: Redfin Property Lookup ---
app.post('/redfin', async (req, res) => {
    console.log('Received request to lookup property.');
    const { street, city, state, zip } = req.body;
    const fullAddress = `${street}, ${city}, ${state}, ${zip}`;

    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

    if (mockPropertyData[fullAddress]) {
        console.log(`Property found: ${fullAddress}`);
        res.status(200).json(mockPropertyData[fullAddress]);
    } else {
        console.log(`Property not found: ${fullAddress}`);
        res.status(404).json({ error: 'Property not found' });
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

// --- Start the server ---
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log('Ready to receive POST requests at /redfin, /stripe/create-checkout, and /calendar/book');
});


// --- ea4-cleanquote Backend Server ---
// This file contains a mock Express.js server that simulates the Stripe checkout and
// the Google Calendar booking process.

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); 

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

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
// This is a mock function that simulates interaction with the Google Calendar API.
// In a real application, you would use a library like 'googleapis' for this.
const mockCalendar = {
    // A mock calendar with pre-booked events to simulate conflicts.
    // The date and time are set relative to today for a realistic test.
    bookedEvents: [
        // Today at 10 AM for 2 hours
        { start: new Date(new Date().setHours(10, 0, 0, 0)), end: new Date(new Date().setHours(12, 0, 0, 0)) },
        // Tomorrow at 1 PM for 1.5 hours
        { start: new Date(new Date().setDate(new Date().getDate() + 1)).setHours(13, 0, 0, 0), end: new Date(new Date().setDate(new Date().getDate() + 1)).setHours(14, 30, 0, 0) }
    ],

    // Function to find the next available slot for a cleaning job.
    findNextAvailableSlot: (estimatedHours, preferredDate) => {
        // Business hours: 9 AM to 5 PM, Monday to Friday
        const businessHoursStart = 9;
        const businessHoursEnd = 17;
        const workWeek = [1, 2, 3, 4, 5]; // Monday to Friday

        let currentDate = new Date(preferredDate);
        currentDate.setHours(businessHoursStart, 0, 0, 0);

        // Loop through days to find an available slot
        for (let i = 0; i < 30; i++) { // Look ahead for up to 30 days
            const dayOfWeek = currentDate.getDay();

            // Skip weekends
            if (!workWeek.includes(dayOfWeek)) {
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(businessHoursStart, 0, 0, 0);
                continue;
            }

            // Loop through time slots within business hours
            for (let hour = businessHoursStart; hour < businessHoursEnd; hour++) {
                const slotStart = new Date(currentDate);
                slotStart.setHours(hour, 0, 0, 0);
                const slotEnd = new Date(slotStart);
                slotEnd.setHours(slotEnd.getHours() + estimatedHours);

                // Check if the slot fits within business hours
                if (slotEnd.getHours() <= businessHoursEnd) {
                    let isConflict = false;
                    for (const event of mockCalendar.bookedEvents) {
                        // Check for overlap with existing events
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

            // Move to the next day
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(businessHoursStart, 0, 0, 0);
        }

        return null; // No slot found
    }
};

// --- Backend Route: Create Stripe Checkout Session ---
app.post('/stripe/create-checkout', async (req, res) => {
  console.log('Received request to create Stripe checkout session.');
  
  const { name, email, address, totalPrice, depositAmount } = req.body;

  if (!name || !email || !address || !depositAmount) {
    console.error('Validation failed: Missing required fields.');
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

// --- NEW Backend Route: Book a Calendar Appointment ---
app.post('/calendar/book', async (req, res) => {
    console.log('Received request to book a calendar appointment.');

    // Destructure the required data from the request body
    const { name, email, address, estimatedHours, preferredStartDate } = req.body;

    // Basic validation
    if (!name || !email || !address || !estimatedHours) {
        return res.status(400).json({ error: 'Missing required fields for booking.' });
    }

    try {
        // In a real app, you would use the Google Calendar API to find and create an event.
        // This mock finds the next available slot based on hardcoded events.
        const bookingResult = mockCalendar.findNextAvailableSlot(estimatedHours, preferredStartDate);

        if (bookingResult) {
            console.log('Successfully booked mock calendar event:', bookingResult);
            
            // In a real app, you would also create the Google Calendar event here.
            // e.g., google.calendar.events.insert({ ... })

            // Respond with the booking details
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
  console.log('Ready to receive POST requests at /stripe/create-checkout and /calendar/book');
});


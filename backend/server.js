// --- ea4-cleanquote Backend Server ---
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); 
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- RentCast API Service ---
const realEstateAPI = {
    apiKey: "671796af0835434297f1c016b70353a1",

    lookupProperty: async (address) => {
        try {
            const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
            console.log(`Making RentCast API call for property: ${fullAddress}`);
            
            const apiUrl = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(fullAddress)}`;
            const headers = { 'X-API-KEY': realEstateAPI.apiKey };
            
            const response = await axios.get(apiUrl, { headers });
            
            const property = response.data[0];

            // ***UPDATED***: Extracts bedrooms and bathrooms along with square footage.
            if (property) {
                return { 
                    squareFootage: property.squareFootage,
                    bedrooms: property.bedrooms,
                    bathrooms: property.bathrooms
                };
            } else {
                return null;
            }

        } catch (error) {
            console.error('RentCast API lookup error:', error.response?.data || error.message);
            return null;
        }
    }
};

// --- MOCK Stripe and Calendar Services ---
const mockStripe = {
  checkout: {
    sessions: {
      create: async (sessionParams) => {
        await new Promise(resolve => setTimeout(resolve, 500)); 
        const mockSessionId = 'cs_test_mock_12345';
        return { url: sessionParams.success_url.replace('{CHECKOUT_SESSION_ID}', mockSessionId) };
      }
    }
  }
};
const mockCalendar = {
    bookedEvents: [
        { start: new Date(new Date().setHours(10, 0, 0, 0)), end: new Date(new Date().setHours(12, 0, 0, 0)) }
    ],
    findNextAvailableSlot: (estimatedHours, preferredDate) => {
        const businessHoursStart = 9, businessHoursEnd = 17, workWeek = [1, 2, 3, 4, 5];
        let currentDate = new Date(preferredDate);
        currentDate.setHours(businessHoursStart, 0, 0, 0);
        for (let i = 0; i < 30; i++) {
            if (workWeek.includes(currentDate.getDay())) {
                for (let hour = businessHoursStart; hour < businessHoursEnd; hour++) {
                    const slotStart = new Date(currentDate);
                    slotStart.setHours(hour, 0, 0, 0);
                    const slotEnd = new Date(slotStart);
                    slotEnd.setHours(slotEnd.getHours() + Math.ceil(estimatedHours));
                    if (slotEnd.getHours() <= businessHoursEnd && !mockCalendar.bookedEvents.some(event => slotStart < event.end && slotEnd > event.start)) {
                        return { status: "booked", startTime: slotStart.toISOString(), endTime: slotEnd.toISOString() };
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(businessHoursStart, 0, 0, 0);
        }
        return null;
    }
};

// --- Backend Routes ---
app.post('/property-lookup', async (req, res) => {
    const address = req.body;
    if (!address.street || !address.city || !address.state || !address.zip) {
        return res.status(400).json({ error: 'Missing required address fields.' });
    }
    try {
        const propertyData = await realEstateAPI.lookupProperty(address);
        if (propertyData) {
            res.status(200).json(propertyData);
        } else {
            res.status(404).json({ error: 'Property not found. Please check the address.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to perform API property lookup.' });
    }
});

app.post('/stripe/create-checkout', async (req, res) => {
  const { name, email, address, totalPrice, depositAmount } = req.body;
  if (!name || !email || !address || !depositAmount) {
    return res.status(400).json({ error: 'Missing required fields for checkout.' });
  }
  try {
    const session = await mockStripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Home Cleaning Deposit' }, unit_amount: Math.round(depositAmount * 100) }, quantity: 1 }],
      mode: 'payment',
      success_url: `http://localhost:${port}/step6.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:${port}/estimate-payment.html`,
      customer_email: email,
    });
    res.status(200).json({ checkout_url: session.url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

app.post('/calendar/book', async (req, res) => {
    const { estimatedHours, preferredStartDate } = req.body;
    if (!estimatedHours) {
        return res.status(400).json({ error: 'Missing required fields for booking.' });
    }
    try {
        const bookingResult = mockCalendar.findNextAvailableSlot(estimatedHours, preferredStartDate);
        if (bookingResult) {
            res.status(200).json(bookingResult);
        } else {
            res.status(404).json({ error: 'No available time slot could be found.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to book calendar event.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Server Start ---
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Access the application at: http://localhost:${port}`);
  });
}

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

// --- RentCast API Service (Unchanged) ---
const realEstateAPI = {
    apiKey: "671796af0835434297f1c016b70353a1",
    lookupProperty: async (address) => {
        try {
            const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
            const apiUrl = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(fullAddress)}`;
            const headers = { 'X-API-KEY': realEstateAPI.apiKey };
            const response = await axios.get(apiUrl, { headers });
            const property = response.data[0];
            if (property) {
                return { squareFootage: property.squareFootage, bedrooms: property.bedrooms, bathrooms: property.bathrooms };
            }
            return null;
        } catch (error) {
            console.error('RentCast API lookup error:', error.response?.data || error.message);
            return null;
        }
    }
};

// --- MOCK Stripe Service (Unchanged) ---
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

// --- MOCK Calendar Service ---
const mockCalendar = {
    bookedEvents: [], // Start with an empty calendar for each server run
    // ***UPDATED***: Function now generates mock availability for the next 14 days
    getAvailability: () => {
        const availability = {};
        const today = new Date();
        const possibleSlots = ['09:00', '11:00', '13:00', '15:00'];
        // ***FIXED***: Changed loop from 7 to 14 to show two weeks of availability.
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
            
            // Simulate some slots being booked
            availability[dateString] = possibleSlots.filter(() => Math.random() > 0.3);
        }
        return availability;
    },
    bookSlot: (startTimeISO) => {
        const startTime = new Date(startTimeISO);
        mockCalendar.bookedEvents.push({ start: startTime });
        return true;
    }
};

// --- Backend Routes ---
app.post('/property-lookup', async (req, res) => {
    const propertyData = await realEstateAPI.lookupProperty(req.body);
    if (propertyData) res.status(200).json(propertyData);
    else res.status(404).json({ error: 'Property not found.' });
});

app.get('/calendar/availability', (req, res) => {
    res.status(200).json(mockCalendar.getAvailability());
});

app.post('/calendar/book', (req, res) => {
    const { startTime, estimatedHours } = req.body;
    if (!startTime || !estimatedHours) {
        return res.status(400).json({ error: 'Missing required fields for booking.' });
    }
    const success = mockCalendar.bookSlot(startTime);
    if (success) {
        const endTime = new Date(new Date(startTime).getTime() + estimatedHours * 60 * 60 * 1000);
        res.status(200).json({ status: "booked", startTime, endTime: endTime.toISOString() });
    } else {
        res.status(409).json({ error: 'Time slot is no longer available.' }); // 409 Conflict
    }
});

app.post('/stripe/create-checkout', async (req, res) => {
  const { depositAmount } = req.body;
  try {
    const session = await mockStripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Simple Home Cleaning Deposit' }, unit_amount: Math.round(depositAmount * 100) }, quantity: 1 }],
      mode: 'payment',
      success_url: `http://localhost:${port}/step6.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:${port}/estimate-payment.html`,
    });
    res.status(200).json({ checkout_url: session.url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));

// --- MOCK Stripe Service (Unchanged) ---
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

// --- MOCK Calendar Service ---
const mockCalendar = {
    bookedEvents: [], // Start with an empty calendar for each server run
    // ***UPDATED***: Function now generates mock availability for the next 14 days
    getAvailability: () => {
        const availability = {};
        const today = new Date();
        const possibleSlots = ['09:00', '11:00', '13:00', '15:00'];
        // ***FIXED***: Changed loop from 7 to 14 to show two weeks of availability.
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
            
            // Simulate some slots being booked
            availability[dateString] = possibleSlots.filter(() => Math.random() > 0.3);
        }
        return availability;
    },
    bookSlot: (startTimeISO) => {
        const startTime = new Date(startTimeISO);
        mockCalendar.bookedEvents.push({ start: startTime });
        return true;
    }
};

// --- Backend Routes ---
app.post('/property-lookup', async (req, res) => {
    const propertyData = await realEstateAPI.lookupProperty(req.body);
    if (propertyData) res.status(200).json(propertyData);
    else res.status(404).json({ error: 'Property not found.' });
});

app.get('/calendar/availability', (req, res) => {
    res.status(200).json(mockCalendar.getAvailability());
});

app.post('/calendar/book', (req, res) => {
    const { startTime, estimatedHours } = req.body;
    if (!startTime || !estimatedHours) {
        return res.status(400).json({ error: 'Missing required fields for booking.' });
    }
    const success = mockCalendar.bookSlot(startTime);
    if (success) {
        const endTime = new Date(new Date(startTime).getTime() + estimatedHours * 60 * 60 * 1000);
        res.status(200).json({ status: "booked", startTime, endTime: endTime.toISOString() });
    } else {
        res.status(409).json({ error: 'Time slot is no longer available.' }); // 409 Conflict
    }
});

app.post('/stripe/create-checkout', async (req, res) => {
  const { depositAmount } = req.body;
  try {
    const session = await mockStripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Simple Home Cleaning Deposit' }, unit_amount: Math.round(depositAmount * 100) }, quantity: 1 }],
      mode: 'payment',
      success_url: `http://localhost:${port}/step6.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:${port}/estimate-payment.html`,
    });
    res.status(200).json({ checkout_url: session.url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));

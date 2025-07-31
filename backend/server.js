// --- ea4-cleanquote Backend Server ---
// This file contains a mock Express.js server that simulates the Stripe checkout process.

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Used to allow cross-origin requests from the frontend

const app = express();
const port = 3000;

// --- Middleware ---
// Enable CORS for all routes to allow the frontend to communicate with this server.
app.use(cors());
// Use body-parser to parse JSON bodies
app.use(bodyParser.json());

// --- Mock Stripe Service ---
// In a real application, you would initialize the official Stripe library here
// const stripe = require('stripe')('sk_test_...');

// This is a mock function that simulates creating a Stripe Checkout Session.
const mockStripe = {
  checkout: {
    sessions: {
      create: async (sessionParams) => {
        // Simulate an asynchronous API call
        await new Promise(resolve => setTimeout(resolve, 500)); 

        // Validate required parameters
        if (!sessionParams.line_items || sessionParams.line_items.length === 0) {
          throw new Error('Missing line items for Stripe session.');
        }

        // Return a mock session object with a URL
        const mockSessionId = 'cs_test_mock_12345';
        return {
          url: `https://checkout.stripe.com/c/${mockSessionId}`
        };
      }
    }
  }
};

// --- Backend Route: Create Stripe Checkout Session ---
app.post('/stripe/create-checkout', async (req, res) => {
  console.log('Received request to create Stripe checkout session.');
  
  // Destructure the required data from the request body
  const { name, email, address, totalPrice, depositAmount } = req.body;

  // Basic validation
  if (!name || !email || !address || !depositAmount) {
    console.error('Validation failed: Missing required fields.');
    return res.status(400).json({ error: 'Missing required fields for checkout.' });
  }

  try {
    // Call the mock Stripe service to create a checkout session.
    // In a real app, you would use: await stripe.checkout.sessions.create(...)
    const session = await mockStripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Home Cleaning Deposit – CleanQuote',
            },
            unit_amount: Math.round(depositAmount * 100), // Stripe expects amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://cleanquote.vercel.app/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://cleanquote.vercel.app/cancel',
      customer_email: email, // Pre-fills the user's email
      metadata: {
        customer_name: name,
        customer_address: address,
        total_price: totalPrice,
      },
    });

    // Send the checkout URL back to the frontend
    console.log('Successfully created mock Stripe session. Redirecting...');
    res.status(200).json({ checkout_url: session.url });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error.message);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

// --- Start the server ---
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log('Ready to receive POST requests at /stripe/create-checkout');
});

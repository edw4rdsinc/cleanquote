// File: /api/property-lookup.js

import axios from 'axios';

const realEstateAPI = {
    // In Vercel, you should set this as an "Environment Variable" in your project settings.
    // Name: RENTCAST_API_KEY
    // Value: 671796af0835434297f1c016b70353a1
    apiKey: process.env.RENTCAST_API_KEY || "671796af0835434297f1c016b70353a1",
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
            // This will log the detailed error on the Vercel server for debugging.
            console.error('RentCast API lookup error:', error.response?.data || error.message);
            // Re-throw the error to be caught by the handler
            throw new Error('Failed to fetch property data from RentCast API.');
        }
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
        const propertyData = await realEstateAPI.lookupProperty(req.body);
        if (propertyData) {
            res.status(200).json(propertyData);
        } else {
            res.status(404).json({ error: 'Property not found.' });
        }
    } catch (error) {
        // This will catch the error from lookupProperty and send a 500 response.
        console.error("Handler error:", error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
}

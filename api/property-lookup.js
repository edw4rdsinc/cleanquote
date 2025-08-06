const axios = require('axios');

const realEstateAPI = {
    apiKey: process.env.RENTCAST_API_KEY || "671796af0835434297f1c016b70353a1", // Use environment variable in production
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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const propertyData = await realEstateAPI.lookupProperty(req.body);
    if (propertyData) {
        res.status(200).json(propertyData);
    } else {
        res.status(404).json({ error: 'Property not found.' });
    }
}
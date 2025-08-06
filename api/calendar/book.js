module.exports = (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { startTime, estimatedHours } = req.body;
    if (!startTime || !estimatedHours) {
        return res.status(400).json({ error: 'Missing required fields for booking.' });
    }
    const endTime = new Date(new Date(startTime).getTime() + estimatedHours * 60 * 60 * 1000);
    res.status(200).json({ status: "booked", startTime, endTime: endTime.toISOString() });
};
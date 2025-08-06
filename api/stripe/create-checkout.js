module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { depositAmount } = req.body;
    const host = req.headers.host;
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    const success_url = `${protocol}://${host}/step6.html`;
    
    const mockSession = {
        url: `${success_url}?session_id=cs_test_mock_12345`
    };
    
    res.status(200).json({ checkout_url: mockSession.url });
};
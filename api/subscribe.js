export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { firstName, email, score, rank } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }

    try {
        const response = await fetch('https://api.omnisend.com/v3/contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.OMNISEND_API_KEY
            },
            body: JSON.stringify({
                email: email,
                firstName: firstName || '',
                status: 'subscribed',
                statusDate: new Date().toISOString(),
                tags: ['morning-oracle-quiz'],
                customProperties: {
                    morningPowerScore: score || '',
                    morningRank: rank || ''
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Omnisend error:', error);
            return res.status(500).json({ error: 'Failed to subscribe' });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Subscribe error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}

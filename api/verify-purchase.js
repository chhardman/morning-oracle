import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
    }

    try {
        // Retrieve the session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // Verify payment was successful
        if (session.payment_status === 'paid') {
            // Generate a time-limited download token
            // This is a simple approach - the token is the session ID itself
            // which Stripe will validate. For extra security, you could
            // create a signed JWT with an expiration time.

            return res.status(200).json({
                success: true,
                customerEmail: session.customer_details?.email || '',
                downloadToken: sessionId,
            });
        } else {
            return res.status(400).json({
                success: false,
                error: 'Payment not completed',
            });
        }
    } catch (error) {
        console.error('Verify error:', error);
        return res.status(500).json({ error: 'Failed to verify purchase' });
    }
}

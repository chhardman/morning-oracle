import Stripe from 'stripe';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check if Stripe key is configured
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('STRIPE_SECRET_KEY is not set');
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = req.headers.origin || 'https://morningroutines.co';
    const addTemplates = req.body?.addTemplates === true;

    const lineItems = [
        {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: 'Mornings Shouldn\'t Suck',
                    description: 'Your guide to the ultimate morning. 22 chapters on health, mindset & discipline.',
                },
                unit_amount: 1200, // $12.00 in cents
            },
            quantity: 1,
        },
    ];

    if (addTemplates) {
        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: 'MSSS Templates + Trackers Pack',
                },
                unit_amount: 900, // $9.00 in cents
            },
            quantity: 1,
        });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/#book`,
            customer_creation: 'always',
            metadata: addTemplates ? { addTemplates: 'true' } : {},
        });

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error('Stripe error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
}

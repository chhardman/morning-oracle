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
            const addTemplatesPurchased = session.metadata?.addTemplates === 'true';
            const customerEmail = session.customer_details?.email || '';
            // Set a secure cookie that lasts 30 days
            // The cookie stores the session ID so we can verify it later
            res.setHeader('Set-Cookie', [
                `purchase_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`
            ]);

            const omnisendApiKey = process.env.OMNISEND_API_KEY;
            if (!customerEmail) {
                console.warn('Omnisend skip: missing customer email');
            } else if (!omnisendApiKey) {
                console.warn('Omnisend skip: missing OMNISEND_API_KEY');
            } else {
                const tags = ['msss-buyer'];
                if (addTemplatesPurchased) {
                    tags.push('msss-templates-buyer');
                }
                tags.push('msss');

                const createdSeconds =
                    typeof session.created === 'number'
                        ? session.created
                        : Math.floor(Date.now() / 1000);
                const msssLastPurchaseAt = new Date(createdSeconds * 1000).toISOString();

                try {
                    const omnisendResponse = await fetch('https://api.omnisend.com/v3/contacts', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': omnisendApiKey,
                        },
                        body: JSON.stringify({
                            email: customerEmail,
                            status: 'subscribed',
                            tags,
                            customProperties: {
                                msssLastPurchaseAt,
                                msssTemplatesAddon: addTemplatesPurchased,
                            },
                        }),
                    });

                    if (!omnisendResponse.ok) {
                        const errorBody = await omnisendResponse.text();
                        console.error(
                            'Omnisend upsert failed:',
                            omnisendResponse.status,
                            errorBody
                        );
                    }
                } catch (omnisendError) {
                    console.error('Omnisend upsert error:', omnisendError);
                }
            }

            return res.status(200).json({
                success: true,
                customerEmail,
                addTemplatesPurchased,
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

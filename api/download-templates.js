import Stripe from 'stripe';
import { getDownloadUrl } from '@vercel/blob';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Parse cookies from request header
function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.split('=');
        cookies[name.trim()] = rest.join('=').trim();
    });
    return cookies;
}

function getFileExtension(url) {
    if (!url) return '.pdf';
    const sanitized = url.split('?')[0];
    const match = sanitized.match(/\.([a-z0-9]+)$/i);
    return match ? `.${match[1]}` : '.pdf';
}

export default async function handler(req, res) {
    // Get session ID from cookie
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies.purchase_session;

    if (!sessionId) {
        return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Access Denied</title></head>
            <body style="font-family: system-ui; padding: 50px; text-align: center;">
                <h1>Access Denied</h1>
                <p>You need to purchase the book to download it.</p>
                <p><a href="/#book">Purchase Mornings Shouldn't Suck →</a></p>
            </body>
            </html>
        `);
    }

    try {
        // Verify the session is still valid and was paid
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return res.status(403).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Access Denied</title></head>
                <body style="font-family: system-ui; padding: 50px; text-align: center;">
                    <h1>Access Denied</h1>
                    <p>Your payment could not be verified.</p>
                    <p>Contact chris@morningroutines.co for help.</p>
                </body>
                </html>
            `);
        }

        // Ensure templates pack was purchased
        if (session.metadata?.addTemplates !== 'true') {
            return res.status(403).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Access Denied</title></head>
                <body style="font-family: system-ui; padding: 50px; text-align: center;">
                    <h1>Access Denied</h1>
                    <p>The Templates + Trackers Pack was not included with this purchase.</p>
                    <p><a href="/#book">Go back →</a></p>
                </body>
                </html>
            `);
        }

        // Payment verified - generate a signed URL that expires
        const templateUrl = process.env.TEMPLATE_PACK_URL;

        if (templateUrl) {
            const extension = getFileExtension(templateUrl);
            // Generate a signed URL that expires in 30 days
            const signedUrl = await getDownloadUrl(templateUrl, {
                expiresIn: 2592000, // 30 days
                downloadFilename: `MSSS-Templates-Trackers-Pack${extension}`,
            });

            res.redirect(302, signedUrl);
        } else {
            res.status(500).json({
                error: 'Templates pack not configured. Set TEMPLATE_PACK_URL environment variable.',
            });
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body style="font-family: system-ui; padding: 50px; text-align: center;">
                <h1>Something went wrong</h1>
                <p>Please try again or contact chris@morningroutines.co for help.</p>
            </body>
            </html>
        `);
    }
}

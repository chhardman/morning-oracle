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

        // Payment verified - generate a signed URL that expires
        const pdfUrl = process.env.BOOK_PDF_URL;

        if (pdfUrl) {
            // Generate a signed URL that expires in 30 days
            const signedUrl = await getDownloadUrl(pdfUrl, {
                expiresIn: 2592000, // 30 days
                downloadFilename: 'Mornings-Shouldnt-Suck.pdf',
            });

            res.redirect(302, signedUrl);
        } else {
            res.status(500).json({
                error: 'PDF not configured. Set BOOK_PDF_URL environment variable.',
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

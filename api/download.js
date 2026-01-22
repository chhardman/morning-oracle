import Stripe from 'stripe';
import { readFileSync } from 'fs';
import { join } from 'path';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ error: 'Download token required' });
    }

    try {
        // Verify the token is a valid paid session
        const session = await stripe.checkout.sessions.retrieve(token);

        if (session.payment_status !== 'paid') {
            return res.status(403).json({ error: 'Invalid or unpaid session' });
        }

        // Optional: Check if download was already used (would need a database)
        // For now, we allow re-downloads which is customer-friendly

        // Serve the PDF
        // In production, you'd want to store this in a private S3 bucket
        // or similar. For now, we'll reference a local file.

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="Mornings-Shouldnt-Suck.pdf"');

        // In Vercel, you'd typically fetch from a private URL like:
        // const pdfUrl = process.env.BOOK_PDF_URL;
        // const response = await fetch(pdfUrl);
        // const buffer = await response.arrayBuffer();
        // res.send(Buffer.from(buffer));

        // For now, redirect to a signed URL or serve directly
        // You'll need to set BOOK_PDF_URL in your environment variables
        // pointing to a private storage location (S3, Cloudflare R2, etc.)

        const pdfUrl = process.env.BOOK_PDF_URL;

        if (pdfUrl) {
            // Redirect to the PDF (if using signed URLs or public storage)
            res.redirect(302, pdfUrl);
        } else {
            res.status(500).json({
                error: 'PDF not configured. Set BOOK_PDF_URL environment variable.',
            });
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
}

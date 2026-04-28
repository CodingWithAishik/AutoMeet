const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();
const cookieparser = require('cookie-parser');
const connectTodb = require('./db/db');
const userRoutes = require('./routes/user.routes');
const committeeRoutes = require('./routes/committee.routes'); // Fix import path
const minutesRoutes = require('./routes/minutes.routes');
const notificationRoutes = require('./routes/notification.routes');
const meetingRoutes = require('./routes/meeting.routes');


connectTodb();

// Helper: normalize configured origins. Accepts values with or without scheme,
// supports comma-separated lists, and rejects obvious placeholder entries.
const normalizeConfiguredOrigins = (...vals) => {
    const out = new Set();
    for (const v of vals.filter(Boolean)) {
        // allow comma-separated lists in a single env var
        for (const part of String(v).split(',')) {
            const s = part.trim();
            if (!s) continue;
            const lower = s.toLowerCase();
            // skip placeholder-like or obviously invalid tokens
            if (lower.includes('placeholder') || lower.includes('[placeholder')) continue;
            // If scheme present, keep as-is; else assume https
            const normalized = /^(https?:)?\/\//i.test(s) ? s.replace(/\/+$/,'') : `https://${s.replace(/\/+$/,'')}`;
            out.add(normalized);
        }
    }
    return out;
};

const allowedOrigins = normalizeConfiguredOrigins(
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGIN_SECONDARY,
    'localhost:5173',
    'localhost:3000'
);

const isAllowedVercelOrigin = (origin) => {
    if (!origin) return false;

    try {
        const { hostname, protocol } = new URL(origin);
        if (protocol !== 'https:') return false;

        return (
            hostname === 'automeet-frontend.vercel.app' ||
            hostname.startsWith('automeet-frontend-') && hostname.endsWith('.vercel.app')
        );
    } catch {
        return false;
    }
};

app.disable('x-powered-by');
app.use(helmet());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' }
}));

app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser or same-origin requests (no Origin header)
        if (!origin) return callback(null, true);

        // First, allow Vercel preview hostnames using pattern matcher
        if (isAllowedVercelOrigin(origin)) return callback(null, true);

        // Normalize runtime origin for comparison
        let runtimeOrigin;
        try {
            runtimeOrigin = new URL(origin).origin.replace(/\/+$/,'');
        } catch (e) {
            return callback(new Error(`Invalid origin header: ${origin}`));
        }

        if (allowedOrigins.has(runtimeOrigin)) return callback(null, true);

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieparser());

app.use('/users', userRoutes);
app.use('/api/committees', committeeRoutes);
app.use('/api/minutes', minutesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/meetings', meetingRoutes);


app.get('/' , (req,res) => {
    res.send('Hello world');
});

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('Unhandled app error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
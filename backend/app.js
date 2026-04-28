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

const allowedOrigins = new Set(
    [
        process.env.CORS_ORIGIN,
        process.env.CORS_ORIGIN_SECONDARY,
        'http://localhost:5173',
        'http://localhost:3000'
    ]
        .filter(Boolean)
        .map((origin) => origin.trim())
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
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.has(origin) || isAllowedVercelOrigin(origin)) {
            return callback(null, true);
        }

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

// Temporary debug endpoint — returns non-secret env values and request origin
// Use this only for short-term debugging in deployments; remove before production
app.get('/_debug/env', (req, res) => {
    const info = {
        env: {
            CORS_ORIGIN: process.env.CORS_ORIGIN || null,
            CORS_ORIGIN_SECONDARY: process.env.CORS_ORIGIN_SECONDARY || null,
            NODE_ENV: process.env.NODE_ENV || null,
            VERCEL_URL: process.env.VERCEL_URL || null
        },
        requestOrigin: req.get('origin') || null,
        receivedHeaders: {
            'x-vercel-id': req.get('x-vercel-id') || null
        }
    };

    return res.json(info);
});

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('Unhandled app error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
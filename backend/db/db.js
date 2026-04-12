const mongoose = require('mongoose');

async function connectTodb() {
    if (!process.env.DB_CONNECT) {
        throw new Error('DB_CONNECT is not configured');
    }

    try {
        await mongoose.connect(process.env.DB_CONNECT, {
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 20,
            minPoolSize: 2
        });
        console.log('Connected to DB');
    } catch (err) {
        console.error('Database connection failed:', err.message);
        throw err;
    }
}

module.exports = connectTodb;
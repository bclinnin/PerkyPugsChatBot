const { Client } = require('pg');

function getDatabaseClient() {
    if (process.env.CURRENT_ENVIRONMENT === 'local') {
        return new Client({
            connectionString: process.env.DATABASE_URL
        });
    } else {
        return new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }
}

async function connectDatabase() {
    const client = getDatabaseClient();
    await client.connect();
    return client;
}

module.exports = { connectDatabase };

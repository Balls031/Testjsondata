const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Parse incoming JSON requests, with a larger limit in case the ZPL data is big
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store received webhooks in memory
// We will store up to 50 of the most recent webhooks
const MAX_WEBHOOKS = 50;
let receivedWebhooks = [];

// Array to hold active Server-Sent Events (SSE) connections
let sseClients = [];

// ------------------------------------------------------------------
// Webhook Receive Endpoint (What the Raspberry Pi hits)
// ------------------------------------------------------------------
app.post('/api/event/zpl-webhook', (req, res) => {
    const timestamp = new Date().toISOString();

    const newWebhook = {
        id: Date.now().toString(),
        timestamp: timestamp,
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query
    };

    // Add to the beginning of the array
    receivedWebhooks.unshift(newWebhook);

    // Keep only the latest MAX_WEBHOOKS
    if (receivedWebhooks.length > MAX_WEBHOOKS) {
        receivedWebhooks = receivedWebhooks.slice(0, MAX_WEBHOOKS);
    }

    // Broadcast the new webhook to all connected frontend clients
    broadcastSseEvent('new_webhook', newWebhook);

    console.log(`[${timestamp}] Received Webhook! ID: ${newWebhook.id}`);

    res.status(200).json({ success: true, message: 'Webhook received successfully' });
});

// ------------------------------------------------------------------
// SSE (Server-Sent Events) Endpoint (What the frontend connects to)
// ------------------------------------------------------------------
app.get('/api/stream', (req, res) => {
    // Set headers necessary for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    res.write('retry: 10000\n\n'); // Tell client to retry after 10s if disconnected

    // Send the current history immediately upon connection
    res.write(`event: initial_data\n`);
    res.write(`data: ${JSON.stringify(receivedWebhooks)}\n\n`);

    // Add this client to our list
    sseClients.push(res);

    // Remove client when they disconnect
    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
    });
});

// Helper function to send an event to all connected clients
function broadcastSseEvent(eventType, data) {
    const dataString = JSON.stringify(data);
    sseClients.forEach(client => {
        try {
            client.write(`event: ${eventType}\n`);
            client.write(`data: ${dataString}\n\n`);
        } catch (err) {
            console.error('Error broadcasting to a client:', err);
        }
    });
}

// ------------------------------------------------------------------
// API endpoint to manually fetch history (fallback)
// ------------------------------------------------------------------
app.get('/api/webhooks', (req, res) => {
    res.json(receivedWebhooks);
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Webhook Viewer Server is running on port ${PORT}`);
    console.log(`👉 View the dashboard at: http://localhost:${PORT}`);
    console.log(`👉 Send webhooks to: http://localhost:${PORT}/api/event/zpl-webhook`);
});

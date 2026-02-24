# ZPL Webhook Viewer

A beautiful, real-time web application to receive and inspect JSON webhooks (like ZPL print jobs from a Raspberry Pi).

## How it works
This is a Node.js + Express server that:
1. Listens for `POST` requests on `/api/event/zpl-webhook`.
2. Stores the payloads in memory.
3. Uses Server-Sent Events (SSE) to instantly push the new data to a beautifully styled web frontend.

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```

Then visit `http://localhost:3000` in your browser.

## Deployment (Render.com)

Since GitHub Pages only supports static sites, this repository is designed to be deployed for **free** on [Render.com](https://render.com).

1. Create a free account on Render.com
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select this repository (`Balls031/Testjsondata`).
4. **Settings:**
   * **Runtime:** Node
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
5. Click **Create Web Service**.

Within a few minutes, Render will give you a live URL (e.g., `https://my-webhook-app.onrender.com`). You will configure your Raspberry Pi to send its webhook data to `https://my-webhook-app.onrender.com/api/event/zpl-webhook`!

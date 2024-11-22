# EventLynk Notification Server

This server handles WebSocket and Push notifications for EventLynk.

## Features

- Real-time notifications using WebSocket
- Push notifications using web-push
- Supabase integration for event tracking
- Production-ready with Heroku support

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file with:
   ```
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_KEY=your-service-key
   VAPID_PUBLIC_KEY=your-vapid-public-key
   VAPID_PRIVATE_KEY=your-vapid-private-key
   CLIENT_URL=your-frontend-domain
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## Deployment

1. Create Heroku app:
   ```bash
   heroku create eventlynk-notifications
   ```

2. Set environment variables:
   ```bash
   heroku config:set SUPABASE_URL=your-supabase-url
   heroku config:set SUPABASE_SERVICE_KEY=your-service-key
   heroku config:set VAPID_PUBLIC_KEY=your-vapid-public-key
   heroku config:set VAPID_PRIVATE_KEY=your-vapid-private-key
   heroku config:set CLIENT_URL=your-frontend-domain
   heroku config:set NODE_ENV=production
   ```

3. Deploy:
   ```bash
   git push heroku main
   ```

## Development

- `npm run dev`: Start development server with hot reload
- `npm start`: Start production server
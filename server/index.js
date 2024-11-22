const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configure web-push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error('Missing VAPID keys');
}

webpush.setVapidDetails(
  'mailto:support@eventlynk.com',
  vapidPublicKey,
  vapidPrivateKey
);

// Store active WebSocket connections
const connections = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('register', async (userId) => {
    if (userId) {
      connections.set(socket.id, userId);
      console.log(`User ${userId} registered`);
    }
  });

  socket.on('disconnect', () => {
    connections.delete(socket.id);
    console.log('Client disconnected:', socket.id);
  });
});

// Function to send push notification
async function sendPushNotification(subscription, data) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(data));
  } catch (error) {
    console.error('Error sending push notification:', error);
    
    if (error.statusCode === 410) {
      // Remove invalid subscription
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('subscription', JSON.stringify(subscription));

      if (deleteError) {
        console.error('Error deleting invalid subscription:', deleteError);
      }
    }
  }
}

// Listen for Supabase changes
const channel = supabase
  .channel('db-changes')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'events' },
    async (payload) => {
      const notification = {
        type: 'event',
        title: 'New Event Posted!',
        body: payload.new.title,
        url: '/events'
      };

      // Send WebSocket notifications
      io.emit('notification', notification);

      // Send push notifications
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('subscription');

      if (subscriptions) {
        for (const sub of subscriptions) {
          await sendPushNotification(JSON.parse(sub.subscription), notification);
        }
      }
    }
  )
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'announcements' },
    async (payload) => {
      const notification = {
        type: 'announcement',
        title: 'New Announcement!',
        body: payload.new.title,
        url: '/announcements'
      };

      // Send WebSocket notifications
      io.emit('notification', notification);

      // Send push notifications
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('subscription');

      if (subscriptions) {
        for (const sub of subscriptions) {
          await sendPushNotification(JSON.parse(sub.subscription), notification);
        }
      }
    }
  )
  .subscribe();

// Root endpoint
app.get('/', (req, res) => {
  res.send('EventLynk Notification Server');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connections: connections.size,
    supabase: !!supabase,
    webpush: !!webpush
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Notification server running on port ${PORT}`);
});
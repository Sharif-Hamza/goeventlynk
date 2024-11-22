import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-production-domain.com'] 
      : ['http://localhost:5173', 'http://localhost:4173'],
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-production-domain.com']
    : ['http://localhost:5173', 'http://localhost:4173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Store active connections
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

// Listen for Supabase changes
const channel = supabase
  .channel('db-changes')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'events' },
    (payload) => {
      broadcastNotification({
        type: 'event',
        title: 'New Event Posted!',
        body: payload.new.title,
        url: '/events'
      });
    }
  )
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'announcements' },
    (payload) => {
      broadcastNotification({
        type: 'announcement',
        title: 'New Announcement!',
        body: payload.new.title,
        url: '/announcements'
      });
    }
  )
  .subscribe();

function broadcastNotification(notification) {
  // Send to all connected clients
  io.emit('notification', notification);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', connections: connections.size });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Notification server running on port ${PORT}`);
});
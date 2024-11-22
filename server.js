import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'stripe-signature']
}));

// Use raw body for Stripe webhooks
app.use('/webhook', express.raw({ type: 'application/json' }));
// Use JSON parser for all other routes
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
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

// Create Stripe Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { eventId, userId } = req.body;

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: event.title,
              description: event.description,
            },
            unit_amount: Math.round(event.price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://buy.stripe.com/test_9AQ6s5b7CgVf1G0144',
      cancel_url: 'https://buy.stripe.com/test_9AQ6s5b7CgVf1G0144',
      metadata: {
        eventId,
        userId,
      },
    });

    // Save checkout session
    const { error: insertError } = await supabase
      .from('stripe_checkout')
      .insert([
        {
          event_id: eventId,
          user_id: userId,
          session_id: session.id,
          price_amount: event.price,
          success_url: session.success_url,
          cancel_url: session.cancel_url,
        },
      ]);

    if (insertError) throw insertError;

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook endpoint
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Update the registration status
      const { error } = await supabase
        .from('stripe_checkout')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('session_id', session.id);

      if (error) {
        console.error('Error updating checkout session:', error);
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Serve static files from the 'dist' directory
app.use(express.static('dist'));

// Serve index.html for all other routes to support client-side routing
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'dist' });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
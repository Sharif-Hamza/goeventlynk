import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with your publishable key
export const stripePromise = loadStripe('pk_test_51QMgG6H93RHd3m5ridrjf6Qq1VDe8AcYVXkqHNrYTkHvmL8NxiMqxiTrw7sYp2NJ8oell5DyB8qoKTb6totw6LRE00D2SoP2G7');
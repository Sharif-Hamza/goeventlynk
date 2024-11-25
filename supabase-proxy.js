const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors());

// Proxy middleware for Supabase storage
app.use('/storage', createProxyMiddleware({
  target: 'https://ixeumchjsmrbzimzmffc.supabase.co',
  changeOrigin: true,
  pathRewrite: {
    '^/storage': '/storage/v1/object/public'
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
  }
}));

// Stripe proxy (optional)
app.use('/stripe', createProxyMiddleware({
  target: 'https://js.stripe.com',
  changeOrigin: true,
  pathRewrite: {
    '^/stripe': '/v3'
  }
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const logger = require('./src/utils/logger');

const app = express();

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
// 1. Webhooks (Must be before express.json middleware for raw body)
const webhookRoutes = require('./src/modules/billing/webhook.routes');
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./src/modules/auth/auth.routes');
const superAdminRoutes = require('./src/modules/admin/superadmin.routes');
const chainRoutes = require('./src/modules/analytics/chain.routes');
const storeRoutes = require('./src/modules/branches/stores.routes');
const usersRoutes = require('./src/modules/users/users.routes');
const adminRoutes = require('./src/modules/admin/admin.routes');
const sapRoutes = require('./src/modules/integrations/sap.routes');
const productsRoutes = require('./src/modules/products/products.routes');

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/chain', chainRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sap', sapRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/transactions', require('./src/modules/orders/transactions.routes'));
app.use('/api/subscription', require('./src/modules/billing/subscription.routes'));
app.use('/api/integrations', require('./src/modules/integrations/integration.routes'));
app.use('/api/promotions', require('./src/modules/promotions/promotions.routes'));

app.get('/', (req, res) => {
  res.send('Koutix Server is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  logger.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

module.exports = app;

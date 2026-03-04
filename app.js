const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
// 1. Webhooks (Must be before express.json middleware for raw body)
const webhookRoutes = require('./routes/webhook.routes');
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth.routes');
const superAdminRoutes = require('./routes/superadmin.routes');
const chainRoutes = require('./routes/chain.routes');
const storeRoutes = require('./routes/stores.routes');
const usersRoutes = require('./routes/users.routes');
const adminRoutes = require('./routes/admin.routes');
const sapRoutes = require('./routes/sap.routes');
const productsRoutes = require('./routes/products.routes');

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/chain', chainRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sap', sapRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/transactions', require('./routes/transactions.routes'));
app.use('/api/subscription', require('./routes/subscription.routes'));
app.use('/api/integrations', require('./integrations/integration.routes'));
app.use('/api/promotions', require('./routes/promotions.routes'));

app.get('/', (req, res) => {
  res.send('Koutix Server is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

module.exports = app;

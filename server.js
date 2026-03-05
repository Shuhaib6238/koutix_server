require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      // Start POS Integration Scheduler
      const integrationScheduler = require('./src/modules/integrations/integration.scheduler');
      integrationScheduler.start().catch(err => console.error('Scheduler start error:', err.message));

      // Load Background Workers (Optional)
      if (process.env.USE_REDIS === 'true') {
        require('./src/workers/integrationWorker');
        require('./src/workers/analyticsWorker');
        console.log('✅ Background job workers initialized');
      } else {
        console.log('⚠️ Background job workers disabled (USE_REDIS=false)');
      }
    });
  })
  .catch((err) => {
    console.error('Database connection error:', err);
  });

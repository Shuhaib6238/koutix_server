const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');
const authMiddleware = require('../middlewares/firebaseAuth.middleware'); // Assuming this exists and sets req.user
const upload = require('../middlewares/upload.middleware');

router.get('/profile', authMiddleware, storeController.getProfile);
router.put('/profile', authMiddleware, upload.single('logo'), storeController.updateProfile);

module.exports = router;

const express = require('express');
const router = express.Router();
const PromotionController = require('./promotions.controller');
const authMiddleware = require('../../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/', PromotionController.getAll);
router.post('/', PromotionController.create);
router.delete('/:id', PromotionController.delete);

module.exports = router;

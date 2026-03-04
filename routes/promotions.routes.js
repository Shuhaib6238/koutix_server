const express = require('express');
const router = express.Router();
const PromotionController = require('../controllers/promotions.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', PromotionController.getAll);
router.post('/', PromotionController.create);
router.delete('/:id', PromotionController.delete);

module.exports = router;

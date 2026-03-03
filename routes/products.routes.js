const express = require('express');
const productController = require('../controllers/products.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const checkSubscription = require('../middlewares/subscription.middleware');

const router = express.Router();

// All product routes require authentication
router.use(authMiddleware);

router.post('/', checkSubscription, roleMiddleware(['SUPER_ADMIN', 'CHAIN_MANAGER', 'BRANCH_MANAGER', 'SuperAdmin', 'ChainManager', 'BranchManager']), productController.createProduct);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.put('/:id', checkSubscription, roleMiddleware(['SUPER_ADMIN', 'CHAIN_MANAGER', 'BRANCH_MANAGER', 'SuperAdmin', 'ChainManager', 'BranchManager']), productController.updateProduct);
router.delete('/:id', checkSubscription, roleMiddleware(['SUPER_ADMIN', 'CHAIN_MANAGER', 'BRANCH_MANAGER', 'SuperAdmin', 'ChainManager', 'BranchManager']), productController.deleteProduct);

module.exports = router;

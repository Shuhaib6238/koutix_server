const express = require('express');
const productController = require('../controllers/products.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = express.Router();

// All product routes require authentication
router.use(authMiddleware);

router.post('/', roleMiddleware(['SuperAdmin', 'ChainManager', 'BranchManager']), productController.createProduct);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.put('/:id', roleMiddleware(['SuperAdmin', 'ChainManager', 'BranchManager']), productController.updateProduct);
router.delete('/:id', roleMiddleware(['SuperAdmin', 'ChainManager', 'BranchManager']), productController.deleteProduct);

module.exports = router;

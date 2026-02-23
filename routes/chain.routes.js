const express = require('express');
const chainController = require('../controllers/chain.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = express.Router();

const partnerController = require('../controllers/partner.controller');

router.post('/signup', partnerController.signupChainManager);

router.post('/stores', authMiddleware, roleMiddleware(['ChainManager']), chainController.inviteBranchManager);
router.get('/stores', authMiddleware, roleMiddleware(['ChainManager']), chainController.getBranches);
router.get('/dashboard', authMiddleware, roleMiddleware(['ChainManager', 'BranchManager']), chainController.getDashboardStats);

module.exports = router;

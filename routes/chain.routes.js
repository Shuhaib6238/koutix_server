const express = require('express');
const chainController = require('../controllers/chain.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = express.Router();

const partnerController = require('../controllers/partner.controller');

router.post('/signup', partnerController.signupChainManager);

router.post('/branch', authMiddleware, roleMiddleware(['ChainManager']), chainController.createBranch);
router.post('/invite-manager', authMiddleware, roleMiddleware(['ChainManager']), chainController.inviteBranchManager);
router.get('/branches', authMiddleware, roleMiddleware(['ChainManager']), chainController.getBranches);

module.exports = router;

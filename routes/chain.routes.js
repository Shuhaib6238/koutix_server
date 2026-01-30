const express = require('express');
const chainController = require('../controllers/chain.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = express.Router();

router.post('/branch', authMiddleware, roleMiddleware(['ChainManager']), chainController.createBranch);
router.post('/invite-manager', authMiddleware, roleMiddleware(['ChainManager']), chainController.inviteBranchManager);
router.get('/branches', authMiddleware, roleMiddleware(['ChainManager']), chainController.getBranches);

module.exports = router;

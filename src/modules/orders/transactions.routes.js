const express = require('express');
const transactionController = require('./transactions.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/', authMiddleware, transactionController.getTransactions);
router.get('/:id', authMiddleware, transactionController.getTransactionById);

module.exports = router;

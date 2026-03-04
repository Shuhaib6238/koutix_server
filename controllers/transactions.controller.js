const Transaction = require('../models/transaction.model');

class TransactionController {
    async getTransactions(req, res) {
        try {
            const org_id = req.user.org_id;
            const { branch_id, status } = req.query;

            let query = { org_id };
            if (branch_id) query.branch_id = branch_id;
            if (status && status !== 'all') {
                // Normalize status case for comparison if needed
                query.status = new RegExp(`^${status}$`, 'i');
            }

            const transactions = await Transaction.find(query)
                .sort({ createdAt: -1 })
                .populate('branch_id', 'name');

            res.status(200).json(transactions);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async getTransactionById(req, res) {
        try {
            const { id } = req.params;
            const org_id = req.user.org_id;
            const transaction = await Transaction.findOne({ _id: id, org_id }).populate('branch_id', 'name');
            if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
            res.status(200).json(transaction);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}

module.exports = new TransactionController();

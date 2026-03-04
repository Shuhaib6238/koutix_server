const Promotion = require('../models/promotion.model');

const PromotionController = {
    async getAll(req, res) {
        try {
            const org_id = req.user.org_id || req.user.tenantId;
            const promotions = await Promotion.find({ org_id });
            res.json(promotions);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    },

    async create(req, res) {
        try {
            const org_id = req.user.org_id || req.user.tenantId;
            const promotion = new Promotion({ ...req.body, org_id });
            await promotion.save();
            res.status(201).json(promotion);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    },

    async delete(req, res) {
        try {
            await Promotion.findByIdAndDelete(req.params.id);
            res.json({ message: 'Promotion deleted' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
};

module.exports = PromotionController;

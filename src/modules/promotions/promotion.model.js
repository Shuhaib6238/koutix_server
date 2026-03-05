const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['DISCOUNT', 'COUPON', 'FLASH_SALE', 'BOGO'], default: 'DISCOUNT' },
    discount: { type: String, required: true }, // e.g. "20%", "$10 off"
    status: { type: String, enum: ['active', 'paused', 'expired'], default: 'active' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    branches: { type: String, default: 'All Branches' },
    org_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Promotion', PromotionSchema);

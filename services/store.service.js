const Store = require('../models/store.model');

class StoreService {
  async getStoreById(storeId) {
    const store = await Store.findById(storeId);
    if (!store) {
      throw new Error('Store not found');
    }
    return store;
  }

  async getStoreByOwner(ownerId) {
    const store = await Store.findOne({ owner: ownerId });
    if (!store) {
      throw new Error('Store not found for this owner');
    }
    return store;
  }

  async updateStore(storeId, updateData) {
    const store = await Store.findByIdAndUpdate(
      storeId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!store) {
      throw new Error('Store not found');
    }
    return store;
  }

  async updateBranding(storeId, logo, primaryColor, secondaryColor) {
    const updateData = {};
    if (logo) updateData.logo = logo;
    if (primaryColor) updateData.primaryColor = primaryColor;
    if (secondaryColor) updateData.secondaryColor = secondaryColor;

    return await this.updateStore(storeId, updateData);
  }
}

module.exports = new StoreService();

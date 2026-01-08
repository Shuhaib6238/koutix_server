const Store = require('../models/store.model');
const { successResponse, errorResponse } = require('../utils/response');

exports.getProfile = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.uid });
    if (!store) {
      return errorResponse(res, 'Store not found', 404);
    }
    return successResponse(res, store, 'Store profile retrieved successfully');
  } catch (error) {
    console.error('Error getting store profile:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { storeName, email, phone, address, primaryColor, secondaryColor } = req.body;
    const logoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    let store = await Store.findOne({ owner: req.user.uid });

    if (store) {
      // Update existing store
      store.storeName = storeName || store.storeName;
      store.email = email || store.email;
      store.phone = phone || store.phone;
      store.address = address || store.address;
      store.primaryColor = primaryColor || store.primaryColor;
      store.secondaryColor = secondaryColor || store.secondaryColor;
      if (logoUrl) {
        store.logoUrl = logoUrl;
      }
      await store.save();
    } else {
      // Create new store
      store = new Store({
        owner: req.user.uid,
        storeName,
        email,
        phone,
        address,
        primaryColor,
        secondaryColor,
        logoUrl
      });
      await store.save();
    }

    return successResponse(res, store, 'Store profile updated successfully');
  } catch (error) {
    console.error('Error updating store profile:', error);
    return errorResponse(res, 'Internal server error', 500);
  }
};

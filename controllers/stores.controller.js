const storeService = require('../services/store.service');

class StoreController {
  async getStore(req, res) {
    try {
      const store = await storeService.getStoreById(req.params.id);
      res.status(200).json(store);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async updateStore(req, res) {
    try {
      const store = await storeService.updateStore(req.params.id, req.body);
      res.status(200).json({
        message: 'Store updated successfully',
        data: store
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async uploadLogo(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const logoPath = `/uploads/${req.file.filename}`;
      const store = await storeService.updateStore(req.params.id, { logo: logoPath });

      res.status(200).json({
        message: 'Logo uploaded successfully',
        logo: logoPath,
        data: store
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new StoreController();

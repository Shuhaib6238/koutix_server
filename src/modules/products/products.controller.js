const Product = require('./product.model');

class ProductController {
  /**
   * Create a new product
   */
  async createProduct(req, res) {
    try {
      const { name, sku, price, stock, category, sapMaterialId, sapMetadata } = req.body;
      const org_id = req.user.org_id;

      if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ message: 'Name, price, and stock are required' });
      }

      const product = new Product({
        name,
        sku,
        price,
        stock,
        category,
        sapMaterialId,
        sapMetadata,
        org_id
      });

      await product.save();
      res.status(201).json({ message: 'Product created successfully', product });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Get all products for the current organization
   */
  async getProducts(req, res) {
    try {
      const org_id = req.user.org_id;
      const products = await Product.find({ org_id });
      res.status(200).json(products);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Get a single product by ID
   */
  async getProductById(req, res) {
    try {
      const { id } = req.params;
      const org_id = req.user.org_id;

      const product = await Product.findOne({ _id: id, org_id });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.status(200).json(product);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Update a product
   */
  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const org_id = req.user.org_id;

      const product = await Product.findOneAndUpdate(
        { _id: id, org_id },
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.status(200).json({ message: 'Product updated successfully', product });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const org_id = req.user.org_id;

      const product = await Product.findOneAndDelete({ _id: id, org_id });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new ProductController();

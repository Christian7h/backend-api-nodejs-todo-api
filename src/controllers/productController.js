// controllers/productController.js
const Product = require('../models/Product');
const Category = require('../models/Category');
exports.createProduct = async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'No autorizado' });
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

exports.getProducts = async (req, res, next) => {
  try {
    const { category } = req.query;
    const query = category ? { category } : {};
    const products = await Product.find(query).populate('category');
    res.json(products);
  } catch (error) {
    next(error);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json(product);
  } catch (error) {
    next(error);
  }
};

exports.getProductByCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Categoría no encontrada' });

    const products = await Product.find({ category: req.params.id }).populate('category');
    res.json(products);
  } catch (error) {
    next(error);
  }
};


exports.updateProduct = async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'No autorizado' });
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json(product);
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {  
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'No autorizado' });
  try {
    const product = await Product.findByIdAndDelete(req.params.id);          
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
};  
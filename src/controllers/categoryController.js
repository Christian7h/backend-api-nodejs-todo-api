const Category = require('../models/Category');

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }
    const category = new Category(req.body);
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.status(204).json();
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {  
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    res.json(category);
  } catch (error) {
    next(error);
  }
};
const Review = require('../models/Review');
const Product = require('../models/Product');

// Crear una reseña
exports.createReview = async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const review = new Review({
      user: req.user.id,
      product: productId,
      rating,
      comment,
    });

    await review.save();
    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

// Obtener reseñas de un producto
exports.getReviewsByProduct = async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.productId }).populate('user', 'username');
    res.json(reviews);
  } catch (error) {
    next(error);
  }
};

// Eliminar una reseña
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Reseña no encontrada' });
    }

    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    await review.remove();
    res.json({ message: 'Reseña eliminada exitosamente' });
  } catch (error) {
    next(error);
  }
};

const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
      await cart.save();
    }
    res.json(cart);
  } catch (error) {
    next(error);
  }
};

exports.getCountCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'No hay ningun carrito' });
    }
    res.json(cart.items.length);
  } catch (error) {
    next(error);
  }
};

exports.addToCart = async (req, res, next) => {
  const { product, quantity } = req.body;
  try {
    let cart = await Cart.findOne({ user: req.user.id });
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    if (productExists.stock < quantity) {
      return res.status(400).json({ message: 'Stock insuficiente' });
    }

    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    const itemIndex = cart.items.findIndex((item) => item.product.toString() === product);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ product, quantity });
    }

    cart.updatedAt = Date.now();
    await cart.save();
    await cart.populate('items.product');
    res.json(cart);
  } catch (error) {
    next(error);
  }
};

exports.removeFromCart = async (req, res, next) => {
  const { productId } = req.params;
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Carrito no encontrado' });
    }

    cart.items = cart.items.filter((item) => item.product.toString() !== productId);
    await cart.save();
    await cart.populate('items.product');
    res.json(cart);
  } catch (error) {
    next(error);
  }
};
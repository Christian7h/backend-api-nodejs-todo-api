const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const {
  Options,
  WebpayPlus,
  IntegrationCommerceCodes,
  IntegrationApiKeys,
  Environment,
} = require('transbank-sdk');

console.log('TRANSBANK_COMMERCE_CODE:', process.env.TRANSBANK_COMMERCE_CODE);
console.log('TRANSBANK_API_KEY:', process.env.TRANSBANK_API_KEY);
console.log('TRANSBANK_ENV:', process.env.TRANSBANK_ENV);

// Configura la transacción con el entorno adecuado de integración
const tx = new WebpayPlus.Transaction(
  new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  )
);

const transactionData = {};

exports.initiatePayment = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'El carrito está vacío' });
    }

    let amount = 0;
    const cartItems = cart.items.map(item => ({
      productId: item.product._id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
    }));
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ message: `Stock insuficiente para ${item.product.name}` });
      }
      amount += item.product.price * item.quantity;
    }

    // Redondear el monto a un entero para CLP
    const roundedAmount = Math.round(amount);

    const buyOrder = `ORDER-${Date.now()}`;
    const sessionId = req.user.id.toString();
    const returnUrl = `${process.env.FRONTEND_URL}/orders/confirm`;

    console.log('Creating transaction with:', { buyOrder, sessionId, amount: roundedAmount, returnUrl });

    const response = await tx.create(buyOrder, sessionId, roundedAmount, returnUrl);
    console.log('Transbank response:', response);

    transactionData[response.token] = { cartItems, userId: req.user.id };

    if (response.url) {
      res.json({ url: response.url, token: response.token });
    } else {
      throw new Error('No redirection URL received from Webpay');
    }
  } catch (error) {
    console.error('Error creating transaction:', error.message);
    next(error);
  }
};
exports.confirmPayment = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const response = await tx.commit(token);
    console.log('Transaction commit response:', response);

    if (response.status !== 'AUTHORIZED') {
      return res.status(400).json({ message: 'Pago no autorizado' });
    }

    const { cartItems, userId } = transactionData[token] || {};
    if (!cartItems || !userId) {
      return res.status(400).json({ message: 'Datos de transacción no encontrados' });
    }

    // Crear la orden
    const items = cartItems.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = new Order({
      user: userId,
      items,
      total,
      status: 'completed',
    });
    await order.save();

    // Reducir stock
    for (const item of cartItems) {
      const product = await Product.findById(item.productId);
      product.stock -= item.quantity;
      await product.save();
    }

    // Vaciar carrito
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    // Limpiar datos temporales
    delete transactionData[token];

    res.json({
      status: response.status,
      orderId: response.buy_order,
      amount: response.amount,
      cardLast4Digits: response.card_detail.card_number,
    });
  } catch (error) {
    console.error('Error confirming transaction:', error.message);
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).populate('items.product');
    res.json(orders);
  } catch (error) {
    next(error);
  }
};
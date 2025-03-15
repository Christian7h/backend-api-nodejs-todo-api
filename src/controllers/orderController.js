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
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

// Configura la transacción con el entorno adecuado de integración
const tx = new WebpayPlus.Transaction(
  new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  )
);

// Configuración de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-8270845525110595-031514-06263c0f69ea5026395222590bc275b6-1081593175',
});

const transactionData = {};
const mpTransactionData = {}; // Para almacenar datos de transacciones de Mercado Pago

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

// Método para iniciar pago con Mercado Pago
exports.initiateMercadoPago = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'El carrito está vacío' });
    }

    let amount = 0;
    const items = [];
    
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ message: `Stock insuficiente para ${item.product.name}` });
      }

      amount += item.product.price * item.quantity;
      
      items.push({
        title: item.product.name,
        unit_price: item.product.price,
        quantity: item.quantity,
        currency_id: "CLP", // Ajusta según tu moneda
        description: item.product.description || item.product.name
      });
    }

    const cartItems = cart.items.map(item => ({
      productId: item.product._id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
    }));

    const preference = new Preference(client);
    
    const preferenceData = {
      items,
      back_urls: {
        success: "https://chris-ecommerce-api.netlify.app/orders/mercadopago/success",
        failure: "https://chris-ecommerce-api.netlify.app/orders/mercadopago/failure",
        pending: "https://chris-ecommerce-api.netlify.app/orders/mercadopago/pending",
      },
      auto_return: "approved",
      external_reference: `USER_${req.user.id}_${Date.now()}`,
      notification_url: `${process.env.BACKEND_URL || 'https://backend-api-nodejs-todo-api-production.up.railway.app'}/api/orders/mercadopago/webhook`,
    };

    const response = await preference.create({ body: preferenceData });
    console.log('Mercado Pago response:', response);

    // Guardar datos para usar en el webhook/callback
    mpTransactionData[response.id] = { 
      cartItems, 
      userId: req.user.id, 
      preferenceId: response.id 
    };

    res.json({
      id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
    });
  } catch (error) {
    console.error('Error creating MercadoPago preference:', error.message);
    next(error);
  }
};

// Webhook para recibir notificaciones de Mercado Pago
exports.mercadoPagoWebhook = async (req, res, next) => {
  try {
    const { type, data } = req.body;
    
    // Solo procesar pagos aprobados
    if (type === 'payment') {
      const paymentId = data.id;
      
      // Obtener información del pago
      const payment = new Payment(client);
      const paymentInfo = await payment.get({ id: paymentId });
      console.log('Payment data:', paymentInfo);
      
      if (paymentInfo.status === 'approved') {
        const preferenceId = paymentInfo.preference_id;
        const transactionInfo = mpTransactionData[preferenceId];
        
        if (!transactionInfo) {
          console.error('Transaction data not found for preferenceId:', preferenceId);
          return res.status(404).json({ message: 'Datos de transacción no encontrados' });
        }
        
        // Crear la orden
        const { cartItems, userId } = transactionInfo;
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
          paymentMethod: 'mercadopago',
          paymentId: paymentId,
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
        delete mpTransactionData[preferenceId];
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing MercadoPago webhook:', error.message);
    next(error);
  }
};

// Método para confirmar pago de Mercado Pago desde el frontend
exports.confirmMercadoPago = async (req, res, next) => {
  try {
    const { payment_id, status, preference_id } = req.query;
    
    if (status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'El pago no fue aprobado',
        status
      });
    }

    const payment = new Payment(client);
    const paymentInfo = await payment.get({ id: payment_id });
    
    // Aquí puedes hacer validaciones adicionales si es necesario
    // ...

    res.json({
      success: true,
      payment: {
        id: paymentInfo.id,
        status: paymentInfo.status,
        amount: paymentInfo.transaction_amount,
      }
    });
  } catch (error) {
    console.error('Error confirming MercadoPago payment:', error.message);
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
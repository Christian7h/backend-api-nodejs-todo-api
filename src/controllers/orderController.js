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
        success: `https://chris-ecommerce-api.netlify.app/orders/mercadopago/success`,
        failure: `https://chris-ecommerce-api.netlify.app/orders/mercadopago/failure`,
        pending: `https://chris-ecommerce-api.netlify.app/orders/mercadopago/pending`
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
    const { payment_id, status, preference_id, collection_status } = req.query;
    
    console.log("MercadoPago confirmation received:", { payment_id, status, preference_id, collection_status });

    // Si el estado no es aprobado, intentamos obtener detalles del error
    if (status !== 'approved') {
      let errorReason = 'Pago no aprobado';
      let errorDetails = {};
      
      try {
        // Intentar obtener información detallada del pago rechazado
        if (payment_id) {
          const payment = new Payment(client);
          const paymentInfo = await payment.get({ id: payment_id });
          console.log('Rejected payment details:', JSON.stringify(paymentInfo, null, 2));
          
          // Obtener el motivo específico del rechazo
          errorReason = translateErrorCode(paymentInfo.status_detail);
          
          errorDetails = {
            id: payment_id,
            status: paymentInfo.status,
            amount: paymentInfo.transaction_amount,
            method: paymentInfo.payment_method_id,
            error_code: paymentInfo.status_detail
          };
        }
      } catch (detailError) {
        console.error('Error al obtener detalles del pago rechazado:', detailError.message);
      }
      
      return res.json({
        success: false,
        message: 'El pago fue rechazado',
        status: status,
        reason: errorReason,
        payment: errorDetails
      });
    }

    const payment = new Payment(client);
    const paymentInfo = await payment.get({ id: payment_id });
    
    // Verificar si ya existe una orden con este pago
    const existingOrder = await Order.findOne({ paymentId: payment_id });
    if (existingOrder) {
      return res.json({
        success: true,
        payment: {
          id: paymentInfo.id,
          status: paymentInfo.status,
          amount: paymentInfo.transaction_amount,
        },
        order: existingOrder._id,
        message: 'La orden ya fue procesada anteriormente'
      });
    }
    
    // Verificar si tenemos los datos del carrito en memoria
    const preferenceId = paymentInfo.preference_id;
    let transactionInfo = mpTransactionData[preferenceId];
    
    if (transactionInfo) {
      // Crear orden con datos almacenados
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
        paymentId: payment_id,
      });
      await order.save();

      // Reducir stock
      for (const item of cartItems) {
        try {
          const product = await Product.findById(item.productId);
          if (product) {
            product.stock -= item.quantity;
            await product.save();
          }
        } catch (err) {
          console.error("Error al actualizar stock:", err);
        }
      }

      // Vaciar carrito
      try {
        const cart = await Cart.findOne({ user: userId });
        if (cart) {
          cart.items = [];
          await cart.save();
        }
      } catch (err) {
        console.error("Error al vaciar carrito:", err);
      }

      delete mpTransactionData[preferenceId];
      
      return res.json({
        success: true,
        payment: {
          id: paymentInfo.id,
          status: paymentInfo.status,
          amount: paymentInfo.transaction_amount,
        },
        order: order._id
      });
    } else {
      // Recuperar carrito actual del usuario
      const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
      
      if (cart && cart.items.length > 0) {
        // Crear orden de emergencia con el carrito actual
        const items = cart.items.map(item => ({
          product: item.product._id,
          quantity: item.quantity,
          price: item.product.price,
        }));
        
        const total = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
        
        const order = new Order({
          user: req.user.id,
          items,
          total,
          status: 'completed',
          paymentMethod: 'mercadopago',
          paymentId: payment_id,
        });
        
        await order.save();
        
        // Reducir stock y vaciar carrito
        for (const item of cart.items) {
          const product = item.product;
          product.stock -= item.quantity;
          await product.save();
        }
        
        cart.items = [];
        await cart.save();
        
        return res.json({
          success: true,
          payment: {
            id: paymentInfo.id,
            status: paymentInfo.status,
            amount: paymentInfo.transaction_amount,
          },
          order: order._id,
          message: 'Orden creada con datos del carrito actual'
        });
      } else {
        // Si no hay transacción ni carrito, crear orden mínima
        const order = new Order({
          user: req.user.id,
          items: [{
            product: null,
            quantity: 1,
            price: paymentInfo.transaction_amount
          }],
          total: paymentInfo.transaction_amount,
          status: 'completed',
          paymentMethod: 'mercadopago',
          paymentId: payment_id,
        });
        
        await order.save();
        
        return res.json({
          success: true,
          payment: {
            id: paymentInfo.id,
            status: paymentInfo.status,
            amount: paymentInfo.transaction_amount,
          },
          order: order._id,
          message: 'Orden creada con datos mínimos'
        });
      }
    }
  } catch (error) {
    console.error('Error confirming MercadoPago payment:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar la confirmación del pago',
      error: error.message
    });
  }
};

// Función para traducir códigos de error de Mercado Pago
function translateErrorCode(code) {
  const errorCodes = {
    'cc_rejected_bad_filled_date': 'Fecha de vencimiento incorrecta',
    'cc_rejected_bad_filled_other': 'Datos de tarjeta incorrectos',
    'cc_rejected_bad_filled_security_code': 'Código de seguridad incorrecto',
    'cc_rejected_blacklist': 'La tarjeta está en lista negra',
    'cc_rejected_call_for_authorize': 'La tarjeta requiere autorización',
    'cc_rejected_card_disabled': 'La tarjeta está desactivada',
    'cc_rejected_duplicated_payment': 'Pago duplicado',
    'cc_rejected_high_risk': 'Pago rechazado por riesgo',
    'cc_rejected_insufficient_amount': 'Fondos insuficientes',
    'cc_rejected_invalid_installments': 'Cuotas no válidas',
    'cc_rejected_max_attempts': 'Demasiados intentos'
  };
  
  return errorCodes[code] || 'Error en el procesamiento del pago';
}

// Endpoint para obtener tarjetas de prueba para MercadoPago
exports.getTestCards = (req, res) => {
  res.json({
    testCards: {
      approvedVisa: {
        cardNumber: "4075 5957 1648 3764",
        expirationDate: "11/25",
        cvv: "123",
        cardholderName: "APRO"
      },
      approvedMastercard: {
        cardNumber: "5031 7557 3453 0604",
        expirationDate: "11/25",
        cvv: "123",
        cardholderName: "APRO"
      },
      rejected: {
        cardNumber: "5416 7526 0258 2580",
        expirationDate: "11/25",
        cvv: "123",
        cardholderName: "RECH"
      }
    },
    errorCodes: {
      "cc_rejected_high_risk": "Pago rechazado por seguridad",
      "cc_rejected_insufficient_amount": "Fondos insuficientes",
      "cc_rejected_bad_filled_security_code": "Código de seguridad incorrecto"
    }
  });
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).populate('items.product');
    res.json(orders);
  } catch (error) {
    next(error);
  }
};
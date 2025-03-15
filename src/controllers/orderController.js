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
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-630998023310293-031516-39ddedc703c4673ebd9c11d3becca062-1081593175',
});

const transactionData = {};
const mpTransactionData = {}; // Para almacenar datos de transacciones de Mercado Pago
const mpPaymentMap = {}; // Para mapear payment_id a preference_id

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
    const transactionInfo = {
      cartItems,
      userId: req.user.id,
      preferenceId: response.id,
      createdAt: new Date()
    };
    
    mpTransactionData[response.id] = transactionInfo;
    
    // También guardar una referencia por userId para acceso de emergencia
    const userKey = `user_${req.user.id}_${Date.now()}`; // Sufijo para evitar colisiones
    mpTransactionData[userKey] = transactionInfo;
    
    console.log("Transaction data stored with keys:", response.id, userKey);

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
    console.log("Webhook received:", req.body);
    
    const { type, data } = req.body;
    console.log("Webhook full data:", JSON.stringify(req.body, null, 2));
    
    if (!type || !data) {
      console.log("Invalid webhook data");
      return res.status(200).send('OK');
    }
    
    if (type === 'payment') {
      const paymentId = data.id;
      
      try {
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: paymentId });
        console.log("Payment data from webhook:", JSON.stringify(paymentInfo, null, 2));
        
        // Guardar la relación payment_id -> preference_id para uso futuro
        if (paymentInfo.preference_id) {
          mpPaymentMap[paymentId] = paymentInfo.preference_id;
          console.log(`Mapped payment ${paymentId} to preference ${paymentInfo.preference_id}`);
        }
        
        // Verificar si ya existe una orden con este payment_id para evitar duplicados
        const existingOrder = await Order.findOne({ paymentId });
        if (existingOrder) {
          console.log("Order already exists for payment:", paymentId);
          return res.status(200).send('OK');
        }
        
        if (paymentInfo.status === 'approved') {
          // Intentar obtener la preferencia
          const preferenceId = paymentInfo.preference_id;
          let transactionInfo = null;
          
          if (preferenceId && mpTransactionData[preferenceId]) {
            transactionInfo = mpTransactionData[preferenceId];
          } else {
            console.log("Transaction data not found for preferenceId:", preferenceId);
            
            // Buscar por external_reference si está disponible
            if (paymentInfo.external_reference && paymentInfo.external_reference.startsWith('USER_')) {
              const userId = paymentInfo.external_reference.split('_')[1].split('_')[0];
              
              // Buscar todas las transacciones asociadas a este usuario
              for (const [key, data] of Object.entries(mpTransactionData)) {
                if (data.userId === userId) {
                  console.log(`Found transaction for userId ${userId} with key ${key}`);
                  transactionInfo = data;
                  break;
                }
              }
            }
          }
          
          if (transactionInfo) {
            const { cartItems, userId } = transactionInfo;
            
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
              paymentMethod: 'mercadopago',
              paymentId: paymentId,
            });
            
            await order.save();
            console.log("New order created:", order._id);
            
            // Reducir stock
            for (const item of cartItems) {
              try {
                const product = await Product.findById(item.productId);
                if (product) {
                  product.stock -= item.quantity;
                  await product.save();
                  console.log(`Stock reduced for product ${item.productId}: new stock ${product.stock}`);
                } else {
                  console.log(`Product not found: ${item.productId}`);
                }
              } catch (err) {
                console.error(`Error updating product ${item.productId}:`, err);
              }
            }
            
            // Vaciar carrito
            try {
              const cart = await Cart.findOne({ user: userId });
              if (cart) {
                cart.items = [];
                await cart.save();
                console.log("Cart emptied for user:", userId);
              } else {
                console.log("Cart not found for user:", userId);
              }
            } catch (err) {
              console.error("Error emptying cart:", err);
            }
            
            // Limpiar datos temporales
            if (preferenceId) {
              delete mpTransactionData[preferenceId];
            }
          } else {
            console.log("No transaction data found. Creating emergency order...");
            
            // Intentar obtener información del usuario del pago
            let userId;
            
            if (paymentInfo.external_reference && paymentInfo.external_reference.startsWith('USER_')) {
              userId = paymentInfo.external_reference.split('_')[1].split('_')[0];
              console.log(`Extracted userId from external_reference: ${userId}`);
            }
            
            if (userId) {
              // Crear una orden de emergencia con datos mínimos
              const order = new Order({
                user: userId,
                items: [{
                  product: null, // No tenemos el producto
                  quantity: 1,
                  price: paymentInfo.transaction_amount || 0,
                }],
                total: paymentInfo.transaction_amount || 0,
                status: 'completed',
                paymentMethod: 'mercadopago',
                paymentId: paymentId,
              });
              
              await order.save();
              console.log("Emergency order created:", order._id);
            } else {
              console.log("Unable to create emergency order: no userId found");
            }
          }
        }
      } catch (paymentError) {
        console.error('Error al procesar el pago:', paymentError.message);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing MercadoPago webhook:', error.message);
    res.status(200).send('OK'); // Siempre devolver 200 para que no reintente
  }
};

// Método para confirmar pago de Mercado Pago desde el frontend
exports.confirmMercadoPago = async (req, res, next) => {
  try {
    const { payment_id, status, preference_id, merchant_order_id } = req.query;
    
    console.log("MercadoPago confirmation received:", { payment_id, status, preference_id, merchant_order_id });
    
    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ID de pago'
      });
    }
    
    try {
      // Verificar si ya existe una orden para este pago
      const existingOrder = await Order.findOne({ paymentId: payment_id });
      if (existingOrder) {
        console.log("Order already exists for this payment:", existingOrder._id);
        return res.json({
          success: true,
          payment: {
            id: payment_id,
            status: status,
            amount: existingOrder.total
          },
          message: 'Orden ya procesada anteriormente'
        });
      }
      
      // Obtener información del pago
      const payment = new Payment(client);
      const paymentInfo = await payment.get({ id: payment_id });
      console.log('Payment info details:', JSON.stringify(paymentInfo, null, 2));
      
      if (status !== 'approved' || paymentInfo.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'El pago no fue aprobado',
          status: status
        });
      }
      
      // Buscar la transacción usando preference_id
      let transactionInfo = null;
      
      // 1. Buscar por preference_id
      if (preference_id && mpTransactionData[preference_id]) {
        transactionInfo = mpTransactionData[preference_id];
      } 
      // 2. Buscar por mapping de payment_id a preference_id
      else if (mpPaymentMap[payment_id]) {
        const mappedPreferenceId = mpPaymentMap[payment_id];
        transactionInfo = mpTransactionData[mappedPreferenceId];
      }
      // 3. Buscar por userId (el usuario actual)
      else {
        console.log("Available transactions:", Object.keys(mpTransactionData));
        
        // Buscar todas las transacciones asociadas a este usuario
        for (const [key, data] of Object.entries(mpTransactionData)) {
          if (data.userId === req.user.id) {
            console.log("Found matching user transaction!");
            transactionInfo = data;
            break;
          }
        }
      }
      
      if (transactionInfo) {
        console.log("Found transaction data:", transactionInfo);
        
        const { cartItems, userId } = transactionInfo;
        
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
          paymentMethod: 'mercadopago',
          paymentId: payment_id,
        });
        
        await order.save();
        console.log("New order created:", order._id);
        
        // Reducir stock
        for (const item of cartItems) {
          try {
            const product = await Product.findById(item.productId);
            if (product) {
              product.stock -= item.quantity;
              await product.save();
              console.log(`Stock reduced for product ${item.productId}: new stock ${product.stock}`);
            } else {
              console.log(`Product not found: ${item.productId}`);
            }
          } catch (err) {
            console.error(`Error updating product ${item.productId}:`, err);
          }
        }
        
        // Vaciar carrito
        try {
          const cart = await Cart.findOne({ user: userId });
          if (cart) {
            cart.items = [];
            await cart.save();
            console.log("Cart emptied for user:", userId);
          } else {
            console.log("Cart not found for user:", userId);
          }
        } catch (err) {
          console.error("Error emptying cart:", err);
        }
        
        // Limpiar datos temporales
        if (preference_id) {
          delete mpTransactionData[preference_id];
        }
        
        return res.json({
          success: true,
          payment: {
            id: payment_id,
            status: paymentInfo.status,
            amount: paymentInfo.transaction_amount || total,
          },
          order: order._id
        });
      } else {
        console.log("Transaction data not found!");
        
        // Intentar recuperar información del carrito directamente
        const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
        if (cart && cart.items.length > 0) {
          console.log("Recovering cart data for emergency order creation");
          
          // Crear la orden de emergencia con los datos del carrito actual
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
          console.log("Emergency order created:", order._id);
          
          // Reducir stock
          for (const item of cart.items) {
            const product = item.product;
            product.stock -= item.quantity;
            await product.save();
            console.log(`Stock reduced for product ${product._id}: new stock ${product.stock}`);
          }
          
          // Vaciar carrito
          cart.items = [];
          await cart.save();
          console.log("Cart emptied for user:", req.user.id);
          
          return res.json({
            success: true,
            payment: {
              id: payment_id,
              status: paymentInfo.status,
              amount: paymentInfo.transaction_amount || 0,
            },
            order: order._id,
            message: 'Orden creada en modo de emergencia'
          });
        } else {
          return res.status(404).json({ 
            success: false,
            message: 'Datos de transacción no encontrados, pero el pago fue exitoso' 
          });
        }
      }
    } catch (paymentError) {
      console.error('Error al obtener información del pago:', paymentError.message);
      
      // Incluso con error, intentamos crear una respuesta exitosa
      return res.json({
        success: true,
        payment: {
          id: payment_id,
          status: status,
          amount: 0,
        },
        message: 'Pago registrado pero no se pudo obtener información detallada'
      });
    }
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
    console.error('Error fetching orders:', error.message);
    next(error);
  }
};

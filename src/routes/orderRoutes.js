const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');

// Iniciar el proceso de pago con Transbank
router.post('/initiate', auth, orderController.initiatePayment);

// Confirmar el pago y crear la orden
router.post('/confirm', auth, orderController.confirmPayment);

// Iniciar el proceso de pago con Mercado Pago
router.post('/mercadopago/initiate', auth, orderController.initiateMercadoPago);

// Webhook para recibir notificaciones de Mercado Pago (no necesita autenticación)
router.post('/mercadopago/webhook', orderController.mercadoPagoWebhook);

// Confirmar pago de Mercado Pago desde el frontend
router.get('/mercadopago/confirm', auth, orderController.confirmMercadoPago);

// Obtener tarjetas de prueba para MercadoPago
router.get('/mercadopago/test-cards', orderController.getTestCards);

// Obtener el historial de órdenes
router.get('/', auth, orderController.getOrders);

module.exports = router;
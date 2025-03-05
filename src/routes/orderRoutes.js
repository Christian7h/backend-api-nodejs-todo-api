const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');

// Iniciar el proceso de pago con Transbank
router.post('/initiate', auth, orderController.initiatePayment);

// Confirmar el pago y crear la orden
router.post('/confirm', auth, orderController.confirmPayment);

// Obtener el historial de órdenes
router.get('/', auth, orderController.getOrders);

module.exports = router;
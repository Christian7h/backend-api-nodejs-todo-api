const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify', authController.verify); 
router.get('/google', authController.googleLogin); // Iniciar flujo Google
router.get('/google/callback', authController.googleCallback); // Callback Google
router.get('/me', authController.getProfile); // Nuevo endpoint para obtener perfil
router.put('/me', authController.updateProfile); // Nuevo endpoint para actualizar perfil
module.exports = router;
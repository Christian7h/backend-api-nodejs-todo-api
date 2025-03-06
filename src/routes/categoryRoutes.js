const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const cache = require('../middleware/cache'); // Importa el middleware de caché




router.get('/',cache, categoryController.getCategories);
router.post('/', auth, categoryController.createCategory); // Solo admin

module.exports = router;
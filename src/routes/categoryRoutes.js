const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const cache = require('../middleware/cache'); // Importa el middleware de caché




router.get('/',cache, categoryController.getCategories);
router.post('/', auth, categoryController.createCategory); // Solo admin
router.delete('/:id', auth, categoryController.deleteCategory); // Solo admin
router.put('/:id', auth, categoryController.updateCategory); // Solo admin

module.exports = router;
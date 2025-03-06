
// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');
const cache = require('../middleware/cache'); // Importa el middleware de caché

router.post('/', auth, productController.createProduct); // Solo admin
router.get('/', cache,productController.getProducts);
router.get('/:id', cache, productController.getProductById);
router.get('/category/:id', cache, productController.getProductByCategory);
router.put('/:id', auth, productController.updateProduct); // Solo admin
router.delete('/:id', auth, productController.deleteProduct); // Solo admin

module.exports = router;

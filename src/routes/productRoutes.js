
// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');

router.post('/', auth, productController.createProduct); // Solo admin
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.get('/category/:id', productController.getProductByCategory);
router.put('/:id', auth, productController.updateProduct); // Solo admin
router.delete('/:id', auth, productController.deleteProduct); // Solo admin

module.exports = router;

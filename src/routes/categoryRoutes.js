const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');

router.get('/', categoryController.getCategories);
router.post('/', auth, categoryController.createCategory); // Solo admin

module.exports = router;
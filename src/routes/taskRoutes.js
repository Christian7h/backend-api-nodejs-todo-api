const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { check } = require('express-validator');

router.post(
  '/',
  [
    check('title', 'El título es obligatorio').not().isEmpty(),
    check('title', 'El título debe ser menor a 100 caracteres').isLength({ max: 100 }),
  ],
  taskController.createTask
);

router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);

router.put(
  '/:id',
  [
    check('title', 'El título es obligatorio').optional().not().isEmpty(),
    check('title', 'El título debe ser menor a 100 caracteres').optional().isLength({ max: 100 }),
  ],
  taskController.updateTask
);

router.delete('/:id', taskController.deleteTask);

module.exports = router;
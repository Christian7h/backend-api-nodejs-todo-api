const Task = require('../models/Task');
const { validationResult } = require('express-validator');

// Crear una tarea
exports.createTask = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const task = new Task({ ...req.body, user: req.user });
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

// Obtener todas las tareas
exports.getTasks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, completed } = req.query;
    const query = {};

    if (completed !== undefined) {
      query.completed = completed === 'true';
    }

    // Si no es admin, filtrar por usuario
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(query);

    res.json({
      tasks,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    next(error);
  }
};
// Obtener una tarea por ID
exports.getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
};

// Actualizar una tarea
exports.updateTask = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!task) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
};

// Eliminar una tarea
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Tarea no encontrada' });
    }
    res.json({ message: 'Tarea eliminada exitosamente' });
  } catch (error) {
    next(error);
  }
};
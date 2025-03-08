const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.register = async (req, res, next) => {
  const { email, password, role } = req.body; // Role es opcional
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'Usuario ya existe' });

    user = new User({ email, password });
    if (role && ['user', 'admin'].includes(role)) {
      user.role = role; // Permitir especificar rol (solo para pruebas por ahora)
    }
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role }, // Incluir el rol en el token
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Devolver el token y el rol en la respuesta
    res.json({ token, role: user.role });
  } catch (error) {
    next(error);
  }
};

exports.verify = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No se proporcionó token' });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar al usuario en la base de datos para confirmar que existe
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    // Devolver la información del usuario (id y role)
    res.json({
      id: user._id,
      role: user.role,
    });
  } catch (error) {
    // Si el token es inválido o ha expirado
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};
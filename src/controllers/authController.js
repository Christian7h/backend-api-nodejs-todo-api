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
      { expiresIn: '1h' }
    );

    // Devolver el token y el rol en la respuesta
    res.json({ token, role: user.role });
  } catch (error) {
    next(error);
  }
};
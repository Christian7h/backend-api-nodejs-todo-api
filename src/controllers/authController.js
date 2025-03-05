const User = require('../models/User');
const jwt = require('jsonwebtoken');

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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    next(error);
  }
};
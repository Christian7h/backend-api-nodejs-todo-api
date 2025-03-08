const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

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

// Nuevo: Iniciar flujo de Google
exports.googleLogin = (req, res) => {
  const authUrl = client.generateAuthUrl({
    scope: ['profile', 'email'],
  });
  console.log('Redirecting to:', authUrl);
  res.redirect(authUrl);
};

// Nuevo: Callback de Google
exports.googleCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, sub: googleId, name, picture } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        googleId, // Guardamos el ID de Google
        name, // Nombre del usuario
        picture, // Foto de perfil
        role: 'user', // Rol por defecto
      });
      await user.save();
    } else if (!user.googleId) {
      // Si el usuario ya existe pero no tiene googleId, lo actualizamos
      user.googleId = googleId;
      user.name = name || user.name;
      user.picture = picture || user.picture;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`https://chris-ecommerce-api.netlify.app/auth/callback?token=${token}&role=${user.role}`);
  } catch (error) {
    console.error('Error en googleCallback:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};


exports.getProfile = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No se proporcionó token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -__v');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json({
      email: user.email,
      username: user.username || user.email.split('@')[0],
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || '',
      picture: user.picture || '', // Foto de perfil
      role: user.role,
    });
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

// Endpoint para actualizar el perfil
exports.updateProfile = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No se proporcionó token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const { name, phone, address } = req.body;
    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.address = address || user.address;

    await user.save();

    res.json({
      email: user.email,
      username: user.username || user.email.split('@')[0],
      name: user.name,
      phone: user.phone,
      address: user.address,
      role: user.role,
      picture: user.picture,
    });
  } catch (error) {
    next(error);
  }
};

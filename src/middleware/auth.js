const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  let token;

  // Verifica si el token está en Authorization con prefijo "Bearer"
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]; // Extrae el token después de "Bearer"
  } else {
    // Si no, verifica en x-auth-token
    token = req.header('x-auth-token');
  }

  if (!token) {
    return res.status(401).json({ message: 'No hay token, autorización denegada' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
};

module.exports = auth;
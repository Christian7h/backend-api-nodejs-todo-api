require('dotenv').config();
const express = require('express');
const cors = require("cors");

const connectDB = require('./config/db')
const taskRoutes = require('./routes/taskRoutes');
const errorHandler = require('./middleware/errorHandler');
const auth = require('./middleware/auth');
const reviewRoutes = require('./routes/reviewRoutes');
const app = express();

// Conectar a la base de datos

connectDB();

// Middleware
// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4321', // Permitir solicitudes desde Astro
  credentials: true, // Permitir cookies
  // methods: ['GET', 'POST', 'PUT', 'DELETE'],
  // allowedHeaders: ['Content-Type', 'Authorization'],
  // exposedHeaders: ['Content-Type', 'Authorization'],

  // // Permitir solicitudes desde el frontend
  // preflightContinue: true,
  
}));
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tasks', auth, require('./routes/taskRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));


// Manejo de errores
app.use(errorHandler);

// Puerto

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto${PORT}`);
});
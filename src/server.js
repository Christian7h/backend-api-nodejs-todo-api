require('dotenv').config();
const express = require('express');
const cors = require("cors");

const connectDB = require('./config/db')
const taskRoutes = require('./routes/taskRoutes');
const errorHandler = require('./middleware/errorHandler');
const auth = require('./middleware/auth');
const app = express();

// Conectar a la base de datos
connectDB();

// Middleware
app.use(cors());

app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tasks', auth, require('./routes/taskRoutes')); // Proteger rutas de tareas

// Manejo de errores
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
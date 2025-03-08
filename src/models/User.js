const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  role: { type: String, default: 'user', enum: ['user', 'admin'] },
  username: { type: String },
  name: { type: String },
  phone: { type: String },
  address: { type: String },
  picture: { type: String }, // URL de la foto de perfil
});

// Hash de la contraseña antes de guardar (solo si existe)
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Método para comparar contraseñas (con manejo de casos sin contraseña)
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false; // Si no hay contraseña, no puede coincidir
  }
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
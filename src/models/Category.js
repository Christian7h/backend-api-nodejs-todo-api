const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    unique: true,
    trim: true,
    maxlength: [50, 'El nombre no puede exceder 50 caracteres'],
  },
});

module.exports = mongoose.model('Category', categorySchema);
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres'],
  },
  description: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio no puede ser negativo'],
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'La categoría es obligatoria'],
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'El stock no puede ser negativo'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  imageUrl: {
    type: String,
    default: 'https://res.cloudinary.com/dkefmgkgc/image/upload/v1741983409/pngegg_us9kw8.png'
  },
  
  // Si el producto está activo/disponible
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Descuento aplicado al producto
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Etiquetas para facilitar la búsqueda
  tags: [{
    type: String,
    trim: true
  }],
  
  // Calificación promedio
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  
  // SKU (código único de producto)
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Fecha de última actualización
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para actualizar la fecha de modificación
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();

});

module.exports = mongoose.model('Product', productSchema);
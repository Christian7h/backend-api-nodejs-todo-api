const apicache = require('apicache');

// Configurar caché con una duración de 5 minutos
const cache = apicache.middleware('5 minutes');

module.exports = cache;

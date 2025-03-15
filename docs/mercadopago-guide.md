# Guía de Integración de Mercado Pago

## Tarjetas de Prueba

Para realizar pruebas en ambiente de desarrollo, utiliza estas tarjetas:

### Para pagos aprobados:
- **Visa**: 4075 5957 1648 3764
- **Mastercard**: 5031 7557 3453 0604
- **American Express**: 3711 803032 57522

### Para pagos rechazados:
- Usar cualquiera de las tarjetas anteriores con el nombre del titular **RECH**

Para todas las tarjetas:
- **Fecha de vencimiento**: Cualquier fecha futura (ej: 11/25)
- **CVV**: 123
- **Nombre del titular**: APRO (aprobación) o RECH (rechazo)

## Errores Comunes

### cc_rejected_high_risk
Este error indica que Mercado Pago considera la transacción como de alto riesgo. En un entorno de producción, esto podría deberse a patrones sospechosos en el comportamiento del usuario o la tarjeta.

**Solución**: En ambiente de pruebas, asegúrate de usar las tarjetas de prueba correctamente. En producción, el usuario debería intentar con otra tarjeta o contactar a su banco.

### cc_rejected_insufficient_amount
La tarjeta no tiene fondos suficientes para completar la transacción.

**Solución**: El usuario debe usar otra tarjeta o contactar a su banco.

### cc_rejected_bad_filled_security_code
El código de seguridad ingresado es incorrecto.

**Solución**: Verificar y volver a ingresar el código correctamente.

## Implementación en el Frontend

Cuando recibas un error de pago, puedes mostrar un mensaje específico según el código de error:

```javascript
function showPaymentError(errorCode) {
  const errorMessages = {
    'cc_rejected_high_risk': 'El pago fue rechazado por seguridad. Intenta con otra tarjeta.',
    'cc_rejected_insufficient_amount': 'Fondos insuficientes. Intenta con otra tarjeta.',
    'cc_rejected_bad_filled_security_code': 'El código de seguridad es incorrecto. Verifica y vuelve a intentar.'
  };
  
  return errorMessages[errorCode] || 'Error en el procesamiento del pago. Intenta de nuevo.';
}
```

## WebHooks

Mercado Pago envía notificaciones a través de webhooks. La URL de webhook configurada en esta integración es:


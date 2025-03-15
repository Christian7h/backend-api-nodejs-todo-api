# Guía de errores de Mercado Pago

Esta guía explica los códigos de error comunes que puedes encontrar al procesar pagos con Mercado Pago.

## Códigos de estado para pagos

| Estado | Descripción |
|--------|-------------|
| `approved` | El pago fue aprobado y acreditado |
| `pending` | El usuario no completó el proceso de pago |
| `in_process` | El pago está siendo revisado |
| `rejected` | El pago fue rechazado |
| `refunded` | El pago fue devuelto al usuario |
| `cancelled` | El pago fue cancelado por una de las partes |
| `in_mediation` | Se inició una disputa |

## Códigos de error comunes

| Código | Descripción |
|--------|-------------|
| `cc_rejected_bad_filled_date` | La fecha de vencimiento de la tarjeta es incorrecta |
| `cc_rejected_bad_filled_other` | Algún dato de la tarjeta es incorrecto |
| `cc_rejected_bad_filled_security_code` | El código de seguridad es incorrecto |
| `cc_rejected_blacklist` | La tarjeta está en lista negra |
| `cc_rejected_call_for_authorize` | La tarjeta requiere autorización |
| `cc_rejected_card_disabled` | La tarjeta está desactivada |
| `cc_rejected_duplicated_payment` | El pago fue duplicado |
| `cc_rejected_high_risk` | El pago fue rechazado por riesgo |
| `cc_rejected_insufficient_amount` | La tarjeta no tiene fondos suficientes |
| `cc_rejected_invalid_installments` | La tarjeta no acepta las cuotas seleccionadas |
| `cc_rejected_max_attempts` | Se excedió el límite de intentos de pago |

## Solución de problemas comunes

### 1. Pagos rechazados por seguridad

Si recibes `cc_rejected_high_risk` o `cc_rejected_blacklist`, esto puede deberse a:
- Actividad inusual en la cuenta del cliente
- El cliente está usando la tarjeta desde una ubicación diferente a la habitual
- El monto es inusualmente alto para el historial de compras del cliente

### 2. Problemas con datos de la tarjeta

Si recibes `cc_rejected_bad_filled_...`, verifica:
- Que el nombre coincida exactamente con el de la tarjeta
- Que la fecha de expiración sea correcta
- Que el código de seguridad sea correcto

### 3. Tarjetas de prueba

Para pruebas en ambiente de desarrollo, usa estas tarjetas:
- APRO (aprobación): 5031 7557 3453 0604
- RECH (rechazo): 5416 7526 0258 2580

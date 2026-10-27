// Synthetic content written for this demo. No real patient or clinic records.
export const knowledge = [
  {
    id: 'clinic',
    title: 'Clínica demo · ubicación y contacto',
    content:
      'Clínica Brisa Dental es una clínica ficticia en San José, Costa Rica. La demo no envía mensajes ni realiza llamadas. Moneda: colones costarricenses. Zona horaria: America/Costa_Rica.',
  },
  {
    id: 'hours',
    title: 'Horario y profesionales',
    content:
      'Atendemos de lunes a viernes de 08:00 a 17:00. Los sábados de 08:00 a 12:00. Domingos cerrado. Dra. Valeria Soto y Dr. Andrés Vega atienden valoración y limpieza. La cita completa debe caber en horario. No se permiten citas simultáneas con el mismo profesional.',
  },
  {
    id: 'services',
    title: 'Servicios y tarifas de demostración',
    content:
      'Valoración: 30 minutos, ₡15.000. Limpieza dental: 60 minutos, ₡30.000. Precios ficticios para demostración. El agente no diagnostica, prescribe ni recomienda tratamientos.',
  },
  {
    id: 'booking',
    title: 'Reservas, cancelaciones y cambios',
    content:
      'Para reservar se necesita nombre ficticio del paciente, servicio, profesional, fecha y hora. Consultar disponibilidad real antes de proponer. Cancelar y reagendar requieren identificar la cita sin ambigüedad. Toda escritura requiere confirmar la tarjeta. Una propuesta no reserva el espacio. Su vigencia es de 10 minutos; al confirmar se verifica otra vez la disponibilidad.',
  },
  {
    id: 'privacy',
    title: 'Datos y alcance de la demo',
    content:
      'Usar solo personas y situaciones inventadas. No ingresar expedientes, identificaciones, teléfonos ni datos clínicos reales. El asistente gestiona operaciones administrativas. WhatsApp y voz en vivo aún no están conectados.',
  },
];
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function retrieveKnowledge(query: string) {
  const words = normalize(query)
    .split(/\W+/)
    .filter((w) => w.length > 2);
  return knowledge
    .map((source) => ({
      ...source,
      score: words.reduce(
        (n, w) => n + (normalize(source.title + ' ' + source.content).includes(w) ? 1 : 0),
        0,
      ),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

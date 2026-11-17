import {
  CANCELLATION_CUTOFF_HOURS as CUTOFF,
  LATE_RESCHEDULE_HOURS as LATE,
} from "@empire-cleaning/models";
import type { Faq } from "./faqs.ts";

// the home page's questions in Spanish (faqs.ts has the English): a draft
// the owner checks (#206)

// faqs.ts's deposit and moveOrCancel, in Spanish
export const deposito: Faq = {
  question: "¿Cómo funciona el depósito?",
  answer:
    "Para reservar, acepta su cotización en línea y paga un depósito. El resto se cobra cuando la limpieza está terminada. Un plan de limpieza tiene un solo depósito durante toda su vida, que se aplica a su última visita.",
};
export const reprogramarOCancelar = `Reprogramar o cancelar con ${LATE} horas o más de anticipación es gratis. Reprogramar con menos de ${LATE} horas es gratis una vez por limpieza; cancelar con menos de ${CUTOFF} horas conserva el depósito como cargo.`;

// asked on the home page and every area's. The English pages ask "Do you
// speak Spanish?"; to someone already reading Spanish, the answer is that
// they can talk to us in it
export const hablamosEspanol: Faq = {
  question: "¿Me pueden atender en español?",
  answer:
    "Sí. Nuestro equipo habla español e inglés, así que puede hablar con nosotros en el idioma que prefiera.",
};

export const faqs: Faq[] = [
  {
    question: "¿Cuánto cuesta una limpieza?",
    answer:
      "Cada casa recibe su propia cotización, calculada a partir de la limpieza que elija, los dormitorios y baños, cuántos pisos, las mascotas o adicionales, y cuánta limpieza necesita. Pida una y se la enviamos por correo, normalmente en un día hábil.",
    more: {
      page: { kind: "guide", guide: "cost" },
      text: "Qué influye en el precio",
    },
  },
  {
    question: "¿Tengo que estar en casa mientras limpian?",
    answer:
      "No. Muchos de nuestros clientes están en el trabajo. Díganos cómo entramos, ya sea una llave, una caja de seguridad, un código o el portero, y cerramos con llave al terminar.",
  },
  {
    question: "¿Está bien si tengo mascotas?",
    answer:
      "Claro que sí. Díganoslo cuando pida una cotización, para que esté en el tiempo que calculamos y el equipo sepa a quién va a encontrar en la puerta.",
  },
  deposito,
  {
    question: "¿Puedo reprogramar o cancelar una limpieza?",
    answer: `Sí, desde su cuenta. ${reprogramarOCancelar}`,
  },
  {
    question: "¿Dónde limpian?",
    answer:
      "En Queens, Brooklyn, Manhattan, todo el condado de Nassau y el oeste del condado de Suffolk, tanto en casas como en negocios.",
  },
  hablamosEspanol,
];

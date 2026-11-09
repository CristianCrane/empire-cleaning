import type { ServicePageWords } from "./index.ts";
import { addOnsNote } from "./shared.ts";

// the page in Spanish (deep-cleaning.ts has the English):
// a draft the owner checks (#206)
export const deepCleaning: ServicePageWords = {
  slug: "limpieza-profunda",
  title: "Limpieza profunda en Queens, NYC y Long Island",
  description:
    "Una limpieza profunda de su casa de arriba abajo en Queens, Brooklyn, Manhattan o Long Island: cada cuarto, detrás de los electrodomésticos, cada zócalo. Pida una cotización.",
  heading: "Limpieza profunda, de arriba abajo",
  intro:
    "Una limpieza profunda llega a todo lo que una limpieza regular no alcanza cada vez: los zócalos, las rejillas de ventilación, detrás de los electrodomésticos, las juntas de los azulejos. Es la limpieza que recomendamos para nuestra primera visita a cualquier casa.",
  included: {
    title: "Qué incluye una limpieza profunda",
    rooms: [
      {
        name: "Cocina",
        items: [
          "Encimeras, salpicadero y fregadero restregados",
          "Estufa y campana desengrasadas",
          "Exterior de cada electrodoméstico, gabinete y cajón limpiado",
          "Detrás y debajo de los electrodomésticos que podemos mover sin riesgo",
          "Piso lavado de borde a borde",
        ],
      },
      {
        name: "Baños",
        items: [
          "Ducha, bañera y azulejos restregados y sin sarro",
          "Juntas de los azulejos restregadas",
          "Inodoro limpio por dentro, por fuera y por detrás",
          "Lavabos, grifos y espejos pulidos",
          "Piso lavado de borde a borde",
        ],
      },
      {
        name: "Dormitorios y áreas comunes",
        items: [
          "Polvo arriba y abajo: ventiladores de techo, lámparas, rejillas, repisas",
          "Marcos y rieles de las ventanas",
          "Debajo de las camas y los sofás, hasta donde llegamos",
          "Pisos aspirados y trapeados",
        ],
      },
      {
        name: "En toda la casa",
        items: [
          "Zócalos, puertas y marcos de puertas limpiados",
          "Interruptores, manijas y barandales limpiados",
          "Basura vaciada",
        ],
      },
    ],
    note: addOnsNote.es,
  },
  pricing: {
    title: "Cómo se calcula el precio de una limpieza profunda",
    text: [
      "Cada casa es distinta, así que no publicamos un precio. Su cotización se calcula a partir de su casa: los dormitorios y baños, cuántos pisos, si hay mascotas, los extras que elija y cuánta limpieza necesita (ligera, moderada o intensa).",
      "Una limpieza profunda tarda más que una limpieza estándar, y su cotización dice cuánto tiempo estaremos. Para reservar, acepte la cotización en línea y pague un depósito; el resto se cobra cuando la limpieza está terminada.",
    ],
  },
  when: {
    title: "Cuándo reservar una limpieza profunda",
    text: [
      "Como primera limpieza, antes de que empiecen las visitas regulares: pone toda la casa a un nivel que luego una limpieza regular mantiene. También es la que conviene reservar antes de que lleguen invitados, después de las fiestas, al cambiar de estación o cuando la casa simplemente se le ha escapado de las manos.",
      "¿Se muda? Una casa vacía tiene su propia limpieza: vea la limpieza de mudanza.",
    ],
  },
  faqs: [
    {
      question:
        "¿Qué diferencia hay entre una limpieza profunda y una estándar?",
      answer:
        "Una limpieza estándar mantiene limpia una casa limpia: superficies, cocina, baños y pisos. Una limpieza profunda va más allá, a los zócalos, las rejillas, las juntas, las lámparas y detrás de los electrodomésticos, y tarda más.",
    },
    {
      question:
        "¿Necesito una limpieza profunda antes de las visitas regulares?",
      answer:
        "Se la recomendamos. Nos permite poner todo al día una vez, para que cada visita regular después lo mantenga así. Si prefiere, puede elegir una limpieza estándar para su primera visita.",
    },
    {
      question: "¿Está incluido el interior del horno y del refrigerador?",
      answer:
        "Son extras, junto con el interior de los gabinetes y las ventanas por dentro. Marque los que quiera cuando pida una cotización y se incluyen en el precio.",
    },
    {
      question: "¿Tengo que estar en casa?",
      answer:
        "No. Díganos cómo entramos, ya sea una llave, una caja de seguridad o el portero, y cerramos con llave al terminar.",
    },
    {
      question: "¿Está bien si tengo mascotas?",
      answer:
        "Claro que sí. Díganoslo cuando pida una cotización, para que esté en el tiempo que calculamos y el equipo sepa a quién va a encontrar.",
    },
  ],
};

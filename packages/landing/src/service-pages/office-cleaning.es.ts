import type { ServicePageWords } from "./index.ts";

// the page in Spanish (office-cleaning.ts has the English):
// a draft the owner checks (#206)
export const officeCleaning: ServicePageWords = {
  slug: "limpieza-de-oficinas",
  title: "Limpieza de oficinas en Queens, NYC y Long Island",
  description:
    "Limpieza de oficinas y negocios en Queens, Brooklyn, Manhattan y Long Island, los días y a la hora que usted elija. Primero una visita gratis. Pida una cotización.",
  heading: "Limpieza de oficinas y negocios",
  intro:
    "Espacios de trabajo, cocinas y baños limpios para su equipo y sus visitas, los días que usted elija, fuera de horario si lo prefiere. Primero visitamos el lugar, gratis, para verlo.",
  included: {
    title: "Qué incluye la limpieza de oficinas",
    rooms: [
      {
        name: "Espacios de trabajo",
        items: [
          "Escritorios y mesas limpiados donde están despejados",
          "Papeleras vaciadas y con bolsa nueva",
          "Pisos aspirados y trapeados",
          "Vidrios, divisiones y espejos brillantes",
        ],
      },
      {
        name: "Cocinas y salas de descanso",
        items: [
          "Encimeras, fregaderos y mesas limpios",
          "Exterior de los electrodomésticos limpiado",
          "Piso trapeado",
        ],
      },
      {
        name: "Baños",
        items: [
          "Inodoros, lavabos y accesorios limpios",
          "Espejos brillantes",
          "Piso trapeado",
        ],
      },
      {
        name: "Entradas y espacios compartidos",
        items: [
          "Recepción y salas de espera ordenadas y sin polvo",
          "Manijas, interruptores y barandales limpiados",
          "Puertas de vidrio limpias",
        ],
      },
    ],
    note: "Cada espacio es distinto, y en la visita acordamos exactamente qué se limpia.",
  },
  pricing: {
    title: "Cómo se calcula el precio",
    text: [
      "Pida una cotización para un negocio y díganos el tipo de negocio (una oficina, un consultorio médico, una tienda), más o menos qué tamaño tiene, y los días y la hora en que le gustaría que vayamos. Luego visitamos el lugar, gratis, para ver lo que necesita.",
      "Su cotización se calcula a partir de lo que encontramos: la superficie, el tipo de negocio y cada cuánto vamos. Acéptela en línea y pague un depósito para reservar; cada limpieza se cobra cuando está terminada.",
    ],
  },
  when: {
    title: "Para quién es",
    text: [
      "Oficinas, consultorios médicos y dentales, tiendas, estudios y otros negocios en Queens, Brooklyn, Manhattan y Long Island.",
      "La mayoría de los negocios nos tienen en días fijos cada semana, por la tarde o temprano en la mañana, para que el lugar esté limpio cuando llega el equipo. Una limpieza única, antes de una inauguración o después de una remodelación, también está bien. Cuéntenos de lo que necesite cuidado, como equipos o un cuarto de servidores, y lo planeamos.",
    ],
  },
  faqs: [
    {
      question: "¿Qué pasa en la visita previa?",
      answer:
        "Vamos a ver el espacio: su tamaño, sus cuartos y lo que hay en ellos, y lo que necesite cuidado. Es gratis, y así su cotización tiene el precio de lo que realmente hay.",
    },
    {
      question: "¿Pueden limpiar fuera de horario?",
      answer:
        "Sí. Elija la hora de inicio que prefiera cuando pida una cotización, por la tarde o temprano en la mañana, y díganos cómo entramos.",
    },
    {
      question: "¿Cada cuánto pueden venir?",
      answer:
        "Tan seguido como lo necesite: los días de la semana que elija, cada semana, o para una limpieza única.",
    },
    {
      question: "¿Limpian consultorios médicos y dentales?",
      answer:
        "Sí. Elija médico (Medical) como tipo de negocio cuando pida una cotización, y cuéntenos de lo que necesite un cuidado especial.",
    },
    {
      question: "¿Tenemos que estar ahí?",
      answer:
        "No. Díganos cómo entramos, ya sea una llave, un código o la seguridad del edificio, y cerramos con llave al terminar.",
    },
    {
      question: "¿Podemos cambiar los días más adelante?",
      answer:
        "Sí. Pídanos una nueva cotización con los días que quiera, y desde cuándo, y seguimos desde entonces en los nuevos días.",
    },
    {
      question: "¿Limpian oficinas en edificios compartidos?",
      answer:
        "Sí. Cuéntenos las reglas del edificio en la nota, como una entrada de servicio o un certificado de seguro para la administración, y lo arreglamos antes de la primera limpieza.",
    },
  ],
};

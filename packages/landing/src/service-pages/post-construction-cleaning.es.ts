import type { ServicePageWords } from "./index.ts";

// the page in Spanish (post-construction-cleaning.ts has the English):
// a draft the owner checks (#206)
export const postConstruction: ServicePageWords = {
  slug: "limpieza-despues-de-obras",
  title: "Limpieza después de obras en Queens y Long Island",
  description:
    "Limpieza después de obras y renovaciones en Queens, Brooklyn, Manhattan y Long Island: el polvo fino y los residuos quitados para que pueda volver a su casa. Pida una cotización.",
  heading: "Limpieza después de obras",
  intro:
    "Los constructores se fueron, pero el polvo no. Quitamos el polvo fino de la obra y los residuos de cada superficie, de arriba abajo, para que pueda volver a su casa.",
  included: {
    title: "Qué incluye una limpieza después de obras",
    rooms: [
      {
        name: "Cada cuarto",
        items: [
          "Polvo quitado de arriba abajo: bordes del techo, rejillas, lámparas, repisas",
          "Paredes sin polvo, y puertas, marcos y zócalos limpiados",
          "Marcos, rieles y bordes de las ventanas",
          "Interruptores y enchufes limpiados",
        ],
      },
      {
        name: "Cocina y baños",
        items: [
          "Gabinetes, encimeras y accesorios limpios de polvo y residuos",
          "Fregaderos, bañeras, duchas e inodoros limpios",
          "Azulejos y accesorios sin la película que deja la obra",
        ],
      },
      {
        name: "Pisos",
        items: ["Aspirados y luego lavados, tantas veces como pida el polvo"],
      },
    ],
    note: "Quitamos el polvo y los residuos, no los escombros: los contratistas se llevan los escombros, los recortes y los materiales que sobran.",
  },
  pricing: {
    title: "Cómo se calcula el precio",
    text: [
      "El polvo de la obra se asienta en todas partes, así que una limpieza después de obras tarda más que una regular. En su solicitud de cotización, elija la limpieza profunda (Deep Clean) para una casa, o la limpieza comercial (Commercial cleaning) para un negocio, marque que necesita mucha limpieza (Heavy) y díganos en la nota qué obra se hizo. Diga más o menos qué tamaño tiene el espacio y en qué cuartos se trabajó, para que la cotización deje tiempo suficiente.",
      "Su cotización dice cuánto tiempo estaremos. Para un negocio, primero visitamos el lugar, gratis, para verlo. Acepte la cotización en línea y pague un depósito para reservar; el resto se cobra cuando la limpieza está terminada.",
    ],
  },
  when: {
    title: "Cuándo reservarla",
    text: [
      "Cuando la obra esté terminada y los trabajadores se hayan ido, y antes de volver a meter los muebles: es mucho más rápido limpiar un cuarto vacío, y nada nuevo se llena de polvo.",
      "Limpiamos después de remodelaciones de cocinas y baños, sótanos terminados, ampliaciones, renovaciones completas y construcciones nuevas, en casas, oficinas y tiendas.",
    ],
  },
  faqs: [
    {
      question: "¿Qué servicio elijo en el formulario?",
      answer:
        "La limpieza profunda (Deep Clean) para una casa, o la limpieza comercial (Commercial cleaning) para un negocio. Marque que necesita mucha limpieza (Heavy), y díganos en la nota que es después de una obra y qué se hizo.",
    },
    {
      question: "¿Cuándo debo reservarla?",
      answer:
        "Cuando la obra esté terminada y antes de volver a meter los muebles. Si los trabajadores todavía van a volver para detalles, resérvela después de su última visita.",
    },
    {
      question: "¿Se llevan los escombros?",
      answer:
        "No. Limpiamos el polvo y los residuos que deja la obra; los contratistas se llevan los escombros y los materiales que sobran.",
    },
    {
      question: "¿Limpian oficinas y tiendas nuevas?",
      answer:
        "Sí. Pida una cotización para un negocio y visitaremos el lugar primero, gratis, para ver lo que necesita.",
    },
    {
      question: "¿Pueden limpiar mientras sigue la obra?",
      answer:
        "Es mejor que no: el polvo se sigue asentando mientras trabajan. Resérvenos después de su última visita, para que la limpieza dure.",
    },
    {
      question: "¿Limpian las ventanas?",
      answer:
        "Los marcos, rieles y bordes son parte de la limpieza. En una casa, las ventanas por dentro son un extra: márquelo en su solicitud de cotización.",
    },
    {
      question: "¿Limpian apartamentos después de una renovación?",
      answer:
        "Sí. Cuéntenos las reglas del edificio en la nota, como un ascensor de servicio que hay que reservar o un certificado de seguro para la administración, y lo arreglamos.",
    },
  ],
};

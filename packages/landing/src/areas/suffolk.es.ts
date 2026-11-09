import { hablamosEspanol } from "../faqs.es.ts";
import type { AreaWords } from "./index.ts";

// Suffolk's page in Spanish (suffolk.ts has the English): a draft the owner
// checks (#206)
export const suffolk: AreaWords = {
  slug: "condado-de-suffolk",
  name: "Oeste del condado de Suffolk",
  short: "el oeste de Suffolk",
  title: "Limpieza de casas en el oeste del condado de Suffolk",
  description:
    "Limpieza de casas en el oeste de Suffolk: Huntington, Babylon, Islip y Smithtown. Profunda, regular, de mudanza y después de obras. Pida una cotización.",
  heading: "Limpieza de casas en el oeste del condado de Suffolk",
  intro:
    "Limpiamos casas en la mitad oeste de Suffolk, en los pueblos de Huntington, Babylon, Islip y Smithtown. Casas de familia, construcciones nuevas y todo lo demás.",
  places: {
    title: "Dónde limpiamos en Suffolk",
    list: [
      "Huntington",
      "Huntington Station",
      "Cold Spring Harbor",
      "Northport",
      "Melville",
      "Dix Hills",
      "Commack",
      "Babylon",
      "West Babylon",
      "Lindenhurst",
      "Amityville",
      "Deer Park",
      "Bay Shore",
      "Islip",
      "Sayville",
      "Smithtown",
      "Hauppauge",
      "Kings Park",
    ],
    note: "No vamos al East End: los Hamptons, el North Fork y los pueblos al este de Smithtown e Islip.",
  },
  homes: {
    title: "Casas de familia, del puerto a la bahía",
    text: [
      "Las casas del oeste de Suffolk son en su mayoría casas con espacio: una colonial en Dix Hills, una ranch en West Babylon, una high ranch en Commack, una casa frente al agua en Northport o Bay Shore. Muchas tienen un sótano terminado, una terraza, una oficina en casa o un cuarto de juegos, y más baños de los que un apartamento de la ciudad tiene cuartos. Díganos los dormitorios y baños, y cualquier extra, cuando pida una cotización, y tendrá el precio para su casa.",
      "Las casas grandes agradecen una rutina. Primero, una limpieza profunda lo deja todo como nuevo, detrás de los electrodomésticos, a lo largo de cada zócalo y en cada escalón. Después, un plan de limpieza lo mantiene así: visitas semanales, cada dos semanas o mensuales, cada una con un 10% de descuento.",
      "Las mascotas pueden quedarse en casa mientras trabajamos. Díganoslo cuando pida una cotización, para que el equipo sepa quién lo recibirá en la puerta, y cuéntenos de los cuartos que prefiere que no toquemos.",
    ],
  },
  popular: {
    title: "Lo que más nos piden en Suffolk",
    list: [
      {
        service: "recurring",
        text: "Una limpieza regular cada dos semanas o mensual para una casa de familia ocupada, el mismo día cada vez.",
      },
      {
        service: "deep",
        text: "De arriba abajo, antes de las visitas, después de las fiestas o como primera visita de un plan de limpieza.",
      },
      {
        service: "post-construction",
        text: "Construcciones nuevas, ampliaciones y remodelaciones de cocina: el polvo de la obra quitado de cada piso para que pueda volver a su casa.",
      },
      {
        service: "move",
        text: "Una casa vacía limpia para la venta, el cierre o el primer día en su nuevo hogar.",
      },
    ],
  },
  faqs: [
    {
      question: "¿Hasta dónde llegan en Suffolk?",
      answer:
        "Los pueblos de Huntington, Babylon, Islip y Smithtown. No vamos más al este, así que los Hamptons y el North Fork quedan fuera de nuestra zona. Si está en el límite y no está seguro, llámenos y pregunte.",
    },
    {
      question: "¿Limpian sótanos y oficinas en casa?",
      answer:
        "Sí. Cuéntenos de ellos cuando pida una cotización para que estén en el precio. Para un garaje o algo fuera de lo común, diga lo que necesita en la nota y se lo cotizamos.",
    },
    {
      question: "¿Tengo que estar en casa?",
      answer:
        "No. Díganos cómo entramos, ya sea una caja de seguridad, un código o una llave debajo del tapete, y cerramos con llave al terminar.",
    },
    hablamosEspanol,
    {
      question: "¿Limpian construcciones nuevas?",
      answer:
        "Sí. Cuando terminan los constructores, una limpieza después de obras quita el polvo de cada piso, y una limpieza profunda o visitas regulares lo mantienen así después de que usted se mude.",
    },
  ],
};

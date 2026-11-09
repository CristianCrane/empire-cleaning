import { hablamosEspanol } from "../faqs.es.ts";
import type { AreaWords } from "./index.ts";

// Nassau's page in Spanish (nassau.ts has the English): a draft the owner
// checks (#206)
export const nassau: AreaWords = {
  slug: "condado-de-nassau",
  name: "Condado de Nassau",
  short: "Nassau",
  title: "Limpieza de casas en el condado de Nassau, NY",
  description:
    "Limpieza de casas en todo el condado de Nassau, de Great Neck a Long Beach: profunda, regular, de mudanza y después de obras. Pida una cotización.",
  heading: "Limpieza de casas en el condado de Nassau",
  intro:
    "Las casas de Long Island son más grandes que los apartamentos de la ciudad, con más dormitorios, más baños y además un sótano. Las limpiamos desde la escalera del ático hasta el cuarto de lavado, en todo Nassau.",
  places: {
    title: "Dónde limpiamos en Nassau",
    list: [
      "Great Neck",
      "Manhasset",
      "Port Washington",
      "Roslyn",
      "Garden City",
      "Mineola",
      "New Hyde Park",
      "Floral Park",
      "Valley Stream",
      "Rockville Centre",
      "Hempstead",
      "Freeport",
      "Long Beach",
      "Westbury",
      "Hicksville",
      "Levittown",
      "Massapequa",
      "Oyster Bay",
    ],
    note: "Cubrimos todo el condado, de la costa norte a la sur.",
  },
  homes: {
    title: "Casas con espacio para limpiar",
    text: [
      "La mayoría de las casas que limpiamos en Nassau son casas independientes: una Cape Cod en Levittown, una colonial en Garden City, una de dos niveles en Massapequa, una casa de playa en Long Beach. Más cuartos y más baños significan una visita más larga, y muchas tienen además un sótano terminado, un cuarto de juegos o una oficina en casa. Cuando pida una cotización, díganos los dormitorios y baños y cualquier extra que quiera limpiar, y le damos el precio para su casa.",
      "Las casas juntan otra suciedad que los apartamentos: arena de la playa, barro del jardín, pelo de mascota en cada escalón. Una limpieza profunda primero llega a todo, detrás de los electrodomésticos y a lo largo de cada zócalo. Después, una limpieza regular lo mantiene al día.",
      "Con un plan de limpieza, después de su primera limpieza usted elige visitas semanales, cada dos semanas o mensuales, y cada una tiene un 10% de descuento. Salte una visita cuando esté de viaje o termine el plan cuando lo necesite.",
    ],
  },
  popular: {
    title: "Lo que más nos piden en Nassau",
    list: [
      {
        service: "recurring",
        text: "Visitas semanales o cada dos semanas para casas de familia: lo bastante seguido para que la casa nunca se le escape de las manos, con un 10% de descuento en cada visita.",
      },
      {
        service: "deep",
        text: "Nuestra primera visita a la mayoría de las casas, y la que conviene reservar antes de un día festivo, una fiesta o una casa llena de invitados.",
      },
      {
        service: "move",
        text: "Si vende, compra o deja un alquiler: una casa vacía limpia de arriba abajo, lista para la inspección o para los nuevos dueños.",
      },
      {
        service: "post-construction",
        text: "Las ampliaciones, las cocinas nuevas y los sótanos terminados dejan polvo por toda la casa. La limpiamos cuando se van los constructores.",
      },
    ],
  },
  faqs: [
    {
      question: "¿Limpian sótanos?",
      answer:
        "Sí. Un sótano terminado se limpia como cualquier otro piso de su casa; cuéntenos de él cuando pida una cotización para que esté en el precio. Para un sótano sin terminar o un garaje, diga lo que necesita en la nota y se lo cotizamos.",
    },
    {
      question: "¿Cuánto tarda la limpieza de una casa más grande?",
      answer:
        "Depende de los cuartos y de cuánta limpieza necesite la casa. Su cotización dice cuánto tiempo estaremos, para que pueda organizar su día.",
    },
    {
      question: "¿Puedo tener el mismo día cada semana?",
      answer:
        "Sí. Un plan de limpieza viene los días que usted elija, cada semana, cada dos semanas o cada mes, y puede saltarse una visita o cambiarla cuando surja algo.",
    },
    hablamosEspanol,
  ],
};

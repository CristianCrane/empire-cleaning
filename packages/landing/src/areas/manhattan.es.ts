import { hablamosEspanol } from "../faqs.es.ts";
import type { AreaWords } from "./index.ts";

// Manhattan's page in Spanish (manhattan.ts has the English): a draft the owner
// checks (#206)
export const manhattan: AreaWords = {
  slug: "manhattan",
  name: "Manhattan",
  short: "Manhattan",
  title: "Limpieza de apartamentos en Manhattan, NY",
  description:
    "Limpieza de apartamentos, co-ops y oficinas en Manhattan, de Harlem al Distrito Financiero. Nos ocupamos del papeleo del edificio. Pida una cotización.",
  heading: "Limpieza de apartamentos y oficinas en Manhattan",
  intro:
    "Los apartamentos de Manhattan son pequeños, muy usados y están en edificios con reglas. Los limpiamos bien, nos arreglamos con el portero y el papeleo, y mantenemos las oficinas limpias cuando todos se han ido a casa.",
  places: {
    title: "Dónde limpiamos en Manhattan",
    list: [
      "Washington Heights",
      "Harlem",
      "Upper West Side",
      "Upper East Side",
      "Midtown",
      "Hell's Kitchen",
      "Murray Hill",
      "Gramercy",
      "Chelsea",
      "Flatiron",
      "Greenwich Village",
      "East Village",
      "Lower East Side",
      "SoHo",
      "Tribeca",
      "Financial District",
    ],
    note: "Cubrimos toda la isla, de Inwood a Battery Park.",
  },
  homes: {
    title: "Edificios con portero, co-ops y edificios sin ascensor",
    text: [
      "La mayoría de nuestros clientes en Manhattan viven en un edificio con reglas: una junta del co-op, un agente administrador, un portero que necesita saber que vamos. Muchos piden un certificado de seguro antes de que alguien trabaje en un apartamento, y algunos solo permiten trabajar entre semana o por la entrada de servicio. Díganos las reglas de su edificio cuando pida una cotización y tendremos el papeleo listo antes de la primera limpieza.",
      "Un apartamento más pequeño no significa una limpieza más rápida. La cocina de un estudio es también su sala, y un apartamento en la ciudad acumula hollín en los marcos y suciedad en las ventanas más rápido de lo que uno cree. Lo limpiamos todo, y lo dejamos como el edificio lo espera, con la basura en su lugar.",
      "No necesita estar en casa. Deje una llave con el portero o díganos cómo entrar, y cerramos con llave al terminar.",
    ],
  },
  popular: {
    title: "Lo que más nos piden en Manhattan",
    list: [
      {
        service: "recurring",
        text: "Una limpieza semanal o cada dos semanas mientras usted trabaja, el mismo día cada vez, con un 10% de descuento en cada visita después de la primera.",
      },
      {
        service: "move",
        text: "Los contratos de alquiler cambian todo el año. Limpiamos el apartamento vacío para la inspección final o para su primera noche.",
      },
      {
        service: "office",
        text: "Oficinas en Midtown, Flatiron y el Distrito Financiero, limpias fuera de horario los días que usted elija. Primero visitamos el lugar para verlo, gratis.",
      },
      {
        service: "deep",
        text: "Los zócalos, los rieles y marcos de las ventanas, detrás del refrigerador: una primera limpieza que deja todo el apartamento como nuevo.",
      },
    ],
  },
  faqs: [
    {
      question: "Mi co-op necesita un certificado de seguro. ¿Pueden enviarlo?",
      answer:
        "Sí. Ponga los datos de su agente administrador en la nota de su solicitud de cotización y le enviamos el certificado antes de su primera limpieza.",
    },
    {
      question: "¿Pueden limpiar mientras estoy en el trabajo?",
      answer:
        "Sí, la mayoría de nuestros clientes en Manhattan no están cuando vamos. Deje una llave con su portero o díganos cómo entramos, y cerramos con llave al salir.",
    },
    {
      question: "¿Cómo funciona la limpieza de oficinas?",
      answer:
        "Pida una cotización para un negocio y elija los días y la hora en que le gustaría que vayamos. Primero visitamos el lugar, gratis, para ver lo que necesita, y luego le enviamos una cotización.",
    },
    hablamosEspanol,
    {
      question: "¿Pueden limpiar un estudio?",
      answer:
        "Sí, apartamentos de cualquier tamaño. Un estudio tiene el precio de sus cuartos como cualquier casa, así que un apartamento más pequeño simplemente significa una visita más corta.",
    },
  ],
};

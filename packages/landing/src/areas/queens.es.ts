import { hablamosEspanol } from "../faqs.es.ts";
import type { AreaWords } from "./index.ts";

// Queens's page in Spanish (queens.ts has the English): a draft the owner
// checks (#206)
export const queens: AreaWords = {
  slug: "queens",
  name: "Queens",
  short: "Queens",
  title: "Limpieza de casas en Queens, NY",
  description:
    "Limpieza de casas, apartamentos, mudanzas y después de obras en todo Queens, de Astoria a Bayside. Pida una cotización en minutos.",
  heading: "Limpieza de casas y apartamentos en Queens",
  intro:
    "Queens es nuestra casa. Limpiamos casas de dos familias, co-ops, edificios sin ascensor y condominios nuevos en cada rincón del condado, para familias, inquilinos y los negocios de sus calles principales.",
  places: {
    title: "Dónde limpiamos en Queens",
    list: [
      "Astoria",
      "Long Island City",
      "Sunnyside",
      "Woodside",
      "Jackson Heights",
      "Elmhurst",
      "Forest Hills",
      "Rego Park",
      "Kew Gardens",
      "Ridgewood",
      "Middle Village",
      "Flushing",
      "Bayside",
      "Whitestone",
      "Fresh Meadows",
      "Jamaica",
    ],
    note: "¿No está en la lista? Cubrimos todo Queens, así que pregúntenos.",
  },
  homes: {
    title: "Todo tipo de casa en Queens",
    text: [
      "Una casa en Queens puede ser casi cualquier cosa: una casa de dos familias en Ridgewood con los dueños abajo y los inquilinos arriba, un co-op de antes de la guerra en Jackson Heights con jardín atrás, un edificio sin ascensor en Astoria o un condominio de vidrio en Long Island City con portero y ascensor de servicio. Limpiamos todas, y le preguntamos por la suya antes de venir, para que la cotización se ajuste al lugar.",
      "Los co-ops y condominios suelen tener reglas para quien trabaja en el edificio: horarios, una entrada de servicio, un certificado de seguro archivado con la administración. Díganos las reglas de su edificio en su solicitud de cotización y las resolvemos antes de la primera limpieza. Si es una casa, cuéntenos del sótano, las escaleras y los cuartos que prefiere que no toquemos.",
      "Muchas casas en Queens tienen mucho movimiento, con niños, mascotas y familiares que entran y salen. Ahí es donde una limpieza regular vale la pena: después de su primera limpieza, elija visitas semanales, cada dos semanas o mensuales, y cada una tiene un 10% de descuento.",
    ],
  },
  popular: {
    title: "Lo que más nos piden en Queens",
    list: [
      {
        service: "move",
        text: "Astoria, Long Island City y Sunnyside están llenos de inquilinos, y los contratos terminan el primero de mes. Dejamos el lugar listo para la inspección final, o para que usted se mude.",
      },
      {
        service: "post-construction",
        text: "Cocinas renovadas, sótanos terminados y casas de dos familias divididas o unidas: quitamos el polvo fino que se asienta en todo cuando se van los contratistas.",
      },
      {
        service: "deep",
        text: "Nuestra primera visita a la mayoría de las casas, de arriba abajo, detrás de los electrodomésticos y a lo largo de cada zócalo. Después, una limpieza estándar la mantiene así.",
      },
      {
        service: "office",
        text: "Oficinas, consultorios y tiendas en Queens Boulevard, Austin Street y Bell Boulevard, limpios fuera de horario los días que usted elija.",
      },
    ],
  },
  faqs: [
    {
      question: "¿Limpian co-ops que piden un certificado de seguro?",
      answer:
        "Sí. Muchos co-ops y condominios de Queens piden un certificado de seguro antes de que entre una compañía de limpieza. Ponga los datos de la administración de su edificio en la nota de su solicitud de cotización y se lo enviamos antes de su primera limpieza.",
    },
    {
      question: "¿Pueden limpiar las dos unidades de una casa de dos familias?",
      answer:
        "Sí, el mismo día o en días distintos. Pida una cotización para cada unidad, para que cada una tenga el precio de sus propios cuartos, y diga en la nota que están en la misma casa.",
    },
    {
      question: "¿Tengo que estar en casa mientras limpian?",
      answer:
        "No. Muchos de nuestros clientes están en el trabajo. Díganos cómo entramos, ya sea una llave con un vecino, una caja de seguridad o el portero, y cerramos con llave al terminar.",
    },
    hablamosEspanol,
  ],
};

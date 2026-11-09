import { hablamosEspanol } from "../faqs.es.ts";
import type { AreaWords } from "./index.ts";

// Brooklyn's page in Spanish (brooklyn.ts has the English): a draft the owner
// checks (#206)
export const brooklyn: AreaWords = {
  slug: "brooklyn",
  name: "Brooklyn",
  short: "Brooklyn",
  title: "Limpieza de casas en Brooklyn, NY",
  description:
    "Limpieza de apartamentos, brownstones, mudanzas y después de obras en Brooklyn, de Greenpoint a Bay Ridge. Pida una cotización hoy.",
  heading: "Limpieza de apartamentos y brownstones en Brooklyn",
  intro:
    "Desde un edificio sin ascensor en Greenpoint hasta un brownstone de cuatro pisos en Park Slope, limpiamos las casas de Brooklyn como se merecen: cada piso, cada escalón, cada rincón.",
  places: {
    title: "Dónde limpiamos en Brooklyn",
    list: [
      "Greenpoint",
      "Williamsburg",
      "Bushwick",
      "Bedford-Stuyvesant",
      "Clinton Hill",
      "Fort Greene",
      "Downtown Brooklyn",
      "Brooklyn Heights",
      "Dumbo",
      "Cobble Hill",
      "Carroll Gardens",
      "Park Slope",
      "Prospect Heights",
      "Crown Heights",
      "Sunset Park",
      "Bay Ridge",
    ],
    note: "¿En otra parte de Brooklyn? Pregúntenos; le decimos enseguida si podemos ir.",
  },
  homes: {
    title: "Brownstones, edificios sin ascensor y torres nuevas",
    text: [
      "Las casas de Brooklyn vienen en capas. Un brownstone o una casa adosada puede tener cuatro pisos unidos por escaleras estrechas, con carpintería original, molduras de yeso y un piso de jardín que es una vivienda en sí. En un edificio sin ascensor, cada balde sube las escaleras con nosotros. Un edificio nuevo en Williamsburg o Downtown Brooklyn puede tener conserje, un ascensor de servicio que hay que reservar y reglas sobre cuándo se puede trabajar.",
      "Cada una de esas cosas cambia cuánto tarda una limpieza, así que le preguntamos por la suya cuando pide una cotización: los pisos, los cuartos, cuánta limpieza necesita. Las casas antiguas reciben un trato cuidadoso en la madera y los azulejos viejos; las nuevas, el vidrio y el acero inoxidable sin marcas que les prometieron.",
      "Las reglas del edificio son parte del trabajo. Si la administración necesita un certificado de seguro o un ascensor reservado, póngalo en la nota y lo arreglamos antes de llegar.",
    ],
  },
  popular: {
    title: "Lo que más nos piden en Brooklyn",
    list: [
      {
        service: "move",
        text: "En Brooklyn la gente se muda rápido, y el contrato muchas veces pide entregar el lugar barrido o mejor. Lo limpiamos vacío, por dentro de cada gabinete y clóset, para que recupere su depósito o empiece de cero.",
      },
      {
        service: "post-construction",
        text: "Las renovaciones completas de brownstones y las cocinas nuevas dejan polvo en cada grieta de una casa vieja. Lo quitamos del último piso hacia abajo.",
      },
      {
        service: "recurring",
        text: "Visitas semanales o cada dos semanas para hogares ocupados, el mismo día cada vez, con un 10% de descuento en cada visita.",
      },
      {
        service: "deep",
        text: "Una primera limpieza que llega a los radiadores, los zócalos y los marcos de las ventanas donde se acumula el polvo en una casa vieja de Brooklyn.",
      },
    ],
  },
  faqs: [
    {
      question: "¿Limpian todos los pisos de un brownstone?",
      answer:
        "Sí. Díganos cuántos pisos, dormitorios y baños tiene cuando pida una cotización, y si el piso de jardín es parte de su casa o está alquilado. Le damos el precio de exactamente lo que vamos a limpiar.",
    },
    {
      question:
        "Mi edificio necesita un certificado de seguro. ¿Pueden enviarlo?",
      answer:
        "Sí. Ponga los datos de su compañía administradora en la nota de su solicitud de cotización y se lo enviamos antes de su primera limpieza, junto con todo lo que pida el edificio, como un ascensor reservado.",
    },
    {
      question: "¿Pueden limpiar el día que me mudo?",
      answer:
        "Normalmente sí, aunque el fin de mes se llena rápido. Pida una cotización en cuanto sepa su fecha, y el lugar debe estar vacío cuando lleguemos para poder llegar a todo.",
    },
    hablamosEspanol,
  ],
};

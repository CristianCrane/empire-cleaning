import { catalog } from "@empire-cleaning/models";

// the public site prototype's words (#505), made up where the site has none
// yet; the build takes the picked ones into words.ts
export const draft = catalog({
  en: {
    what: "House and office cleaning",
    in: "in",
    call: "Call",
    whereTitle: "Where we clean",
    plans: {
      title: "Save 10% with a cleaning plan",
      text: "After your first clean, choose weekly, bi-weekly or monthly visits, each 10% off. Skip one or stop whenever you like.",
    },
    firstStep: "Tell us about your place. It takes a few minutes.",
    quote: {
      intro:
        "We'll email you a price, usually within a working day. No account needed.",
      service: "What can we help with?",
      serviceHelp:
        "Something else? Pick the closest and tell us about it on the next steps.",
      where: "Where is it?",
      what: "What kind of place is it?",
      house: "House",
      apartment: "Apartment",
      townhouse: "Townhouse",
      business: "A business",
      street: "Street address",
      unit: "Apartment or unit (optional)",
      zip: "ZIP code",
      apartmentTitle: "Your apartment",
      condition: "How much cleaning does it need?",
      conditions: ["Light", "Moderate", "Heavy"],
      conditionNote:
        "Lived in, with some build-up in the kitchen and bathrooms",
      bedrooms: "Bedrooms",
      studio: "0 for a studio",
      bathrooms: "Bathrooms",
      halfBaths: "Half-baths count as 0.5",
      extras: "Any extras?",
      extrasNote: "Optional. Your quote will show what each one costs.",
      addOns: ["Inside the fridge", "Inside the oven", "Inside windows"],
      pets: "There are pets at home",
      regular:
        "After my first clean, I'd like regular visits (weekly, bi-weekly or monthly) at 10% off.",
      addNote: "Add a note",
      details: "How do we reach you?",
      fullName: "Full name",
      email: "Email",
      emailNote: "We'll email your quote here.",
      phone: "Phone",
      phoneNote: "Your cleaners can reach you on the day.",
      zipRefused:
        "We couldn't find that ZIP code. Please check it and try again.",
      servicesFailed: "We couldn't load what we offer. Please try again.",
      tryAgain: "Try again",
      failed: "Your request didn't go through. Please try again.",
      sent: "Thanks, we've got your request",
      sentTo:
        "We'll email your quote to maria.lopez@example.com, usually within a working day.",
      step: (at: number, of: number) => `Step ${at} of ${of}`,
      back: "Back",
      next: "Next",
    },
    // each service's describing line in the form, by the site's key; the
    // names are the site's own (services.ts)
    services: {
      standard:
        "The regular upkeep that keeps a clean home feeling that way. Once, or every week or two.",
      deep: "Top to bottom, inside cabinets and behind appliances. Also after building work, or to disinfect.",
      move: "An empty home made spotless, ready for keys to change hands.",
      office:
        "Offices, kitchens and restrooms kept clean for your team and visitors.",
    },
    painting: {
      name: "Painting",
      text: "Walls, ceilings and trim painted cleanly, the room left as we found it.",
    },
    filled: {
      street: "41-12 Bell Blvd",
      unit: "Apt 3B",
      zip: "11361",
      badZip: "11999",
      name: "Maria Lopez",
      email: "maria.lopez@example.com",
      phone: "(718) 555-0142",
    },
  },
  es: {
    what: "Limpieza de casas y oficinas",
    in: "en",
    call: "Llamar",
    whereTitle: "Dónde limpiamos",
    plans: {
      title: "Ahorre un 10% con un plan de limpieza",
      text: "Después de su primera limpieza, elija visitas semanales, cada dos semanas o mensuales, cada una con un 10% de descuento. Sáltese una o pare cuando quiera.",
    },
    firstStep: "Cuéntenos de su lugar. Toma unos minutos.",
    quote: {
      intro:
        "Le enviamos un precio por correo, normalmente en un día hábil. No necesita crear una cuenta.",
      service: "¿En qué le podemos ayudar?",
      serviceHelp:
        "¿Otra cosa? Elija la más parecida y cuéntenos en los siguientes pasos.",
      where: "¿Dónde es?",
      what: "¿Qué tipo de lugar es?",
      house: "Casa",
      apartment: "Apartamento",
      townhouse: "Casa adosada",
      business: "Un negocio",
      street: "Dirección",
      unit: "Apartamento o unidad (opcional)",
      zip: "Código postal",
      apartmentTitle: "Su apartamento",
      condition: "¿Cuánta limpieza necesita?",
      conditions: ["Ligera", "Moderada", "Intensa"],
      conditionNote: "Con uso, algo de acumulación en la cocina y los baños",
      bedrooms: "Dormitorios",
      studio: "0 para un estudio",
      bathrooms: "Baños",
      halfBaths: "Un medio baño cuenta como 0.5",
      extras: "¿Algún adicional?",
      extrasNote: "Opcional. Su cotización muestra lo que cuesta cada uno.",
      addOns: [
        "Dentro del refrigerador",
        "Dentro del horno",
        "Ventanas por dentro",
      ],
      pets: "Hay mascotas en la casa",
      regular:
        "Después de mi primera limpieza, quiero visitas regulares (semanales, cada dos semanas o mensuales) con un 10% de descuento.",
      addNote: "Agregar una nota",
      details: "¿Cómo le contactamos?",
      fullName: "Nombre completo",
      email: "Correo electrónico",
      emailNote: "Le enviamos su cotización a este correo.",
      phone: "Teléfono",
      phoneNote: "Sus limpiadores pueden llamarle ese día.",
      zipRefused:
        "No encontramos ese código postal. Revíselo y vuelva a intentarlo.",
      servicesFailed:
        "No pudimos cargar lo que ofrecemos. Vuelva a intentarlo.",
      tryAgain: "Volver a intentar",
      failed: "Su solicitud no se envió. Vuelva a intentarlo.",
      sent: "Gracias, recibimos su solicitud",
      sentTo:
        "Le enviaremos su cotización a maria.lopez@example.com, normalmente en un día hábil.",
      step: (at: number, of: number) => `Paso ${at} de ${of}`,
      back: "Atrás",
      next: "Siguiente",
    },
    services: {
      standard:
        "El mantenimiento regular de una casa limpia. Una vez, o cada semana o dos.",
      deep: "De arriba abajo, dentro de gabinetes y detrás de electrodomésticos. También después de obras, o para desinfectar.",
      move: "Una casa vacía impecable, lista para entregar las llaves.",
      office: "Oficinas, cocinas y baños limpios para su equipo y sus visitas.",
    },
    painting: {
      name: "Pintura",
      text: "Paredes, techos y molduras pintados con cuidado, y el cuarto queda como lo encontramos.",
    },
    filled: {
      street: "41-12 Bell Blvd",
      unit: "Apt 3B",
      zip: "11361",
      badZip: "11999",
      name: "María López",
      email: "maria.lopez@example.com",
      phone: "(718) 555-0142",
    },
  },
});

import type { Condition, PropertyKind } from "@empire-cleaning/models";
import { business, catalog, messages } from "@empire-cleaning/models";

// The Quote form's words, in English and Spanish (ADR-0025): the form is in
// the language of the page it's on (`lang`), usted to Guests and Clients.
// The Spanish is a draft the owner checks (#206). The Office's form is
// English, and its own words for a caller (officeWords) stay beside it.

const CALL_US = {
  en: `Please try again, or call us on ${business.phone.display}.`,
  es: `Vuelva a intentarlo, o llámenos al ${business.phone.display}.`,
};

export const words = catalog({
  en: {
    // what the form says to the person asking; the Office's are officeWords
    own: {
      need: "What you need",
      service: "What can we help with?",
      servicesFailed: `We couldn't load what we offer. ${CALL_US.en}`,
      what: "What kind of place is it?",
      details: "Your details",
      email: "Email",
      emailNote: "We'll email your quote here.",
      phoneNote: "Your cleaners can reach you on the day.",
      home: "Your home",
      premises: "Your business",
      when: "When would you like us to clean?",
      extrasNote: "Optional. Your quote will show what each one costs.",
      regular:
        "After my first clean, I'd like regular visits (weekly, bi-weekly or monthly) at 10% off.",
      submit: messages.en.REQUEST_A_QUOTE,
      businessName: "Business name",
      contactNote: "The person we'll deal with at the business.",
      failed: `Your request didn't go through. ${CALL_US.en}`,
    },
    house: "House",
    apartment: "Apartment",
    townhouse: "Townhouse",
    aBusiness: "A business",
    whatAndWhere: "What and where",
    where: "Where",
    whichBusiness: "Which business?",
    whichHome: "Which home?",
    differentBusiness: "A different business",
    differentHome: "A different home",
    premisesUnit: "Suite, floor or unit (optional)",
    homeUnit: "Apartment or unit (optional)",
    street: "Street address",
    zip: "ZIP code",
    fullName: "Full name",
    phone: "Phone",
    area: "Area in sq ft (optional)",
    areaNote:
      "Roughly how much there is to do. If you're not sure, we'll measure on our visit.",
    addNote: "Add a note",
    notes: "Anything else we should know?",
    condition: "How much cleaning does it need?",
    extras: "Any extras?",
    extrasGone:
      "Some of the extras you chose are no longer offered. Please check your choices.",
    pets: "There are pets at home",
    howOften: "How often?",
    regularNote: "On set days each week",
    regularly: "Regularly",
    oneOff: "One-off",
    whichDays: "Which days?",
    startTime: "Preferred start time",
    chooseTime: "Choose a time",
    typesFailed: `We couldn't load the types of business. ${CALL_US.en}`,
    typeOfBusiness: "Type of business",
    chooseOne: "Choose one",
    addFloorArea: "Add the floor area",
    floorArea: "Floor area in sq ft (optional)",
    floorAreaNote:
      "Roughly is fine. If you're not sure, we'll measure on our visit.",
    addAccess: "Add how we get in",
    access: "How do we get in? (optional)",
    bedrooms: "Bedrooms",
    studio: "0 for a studio",
    bathrooms: "Bathrooms",
    halfBaths: "Half-baths count as 0.5",
    floors: "Floors",
    step: (at: number, of: number) => `Step ${at} of ${of}`,
    back: "Back",
    next: "Next",
  },
  es: {
    own: {
      need: "Lo que necesita",
      service: "¿En qué le podemos ayudar?",
      servicesFailed: `No pudimos cargar lo que ofrecemos. ${CALL_US.es}`,
      what: "¿Qué tipo de lugar es?",
      details: "Sus datos",
      email: "Correo electrónico",
      emailNote: "Le enviaremos su cotización a este correo.",
      phoneNote: "Sus limpiadores le pueden llamar el día de la limpieza.",
      home: "Su casa",
      premises: "Su negocio",
      when: "¿Cuándo quiere que limpiemos?",
      extrasNote: "Opcional. Su cotización dirá lo que cuesta cada uno.",
      regular:
        "Después de mi primera limpieza, quiero visitas regulares (semanales, cada dos semanas o mensuales) con un 10% de descuento.",
      submit: messages.es.REQUEST_A_QUOTE,
      businessName: "Nombre del negocio",
      contactNote: "La persona con quien trataremos en el negocio.",
      failed: `Su solicitud no se envió. ${CALL_US.es}`,
    },
    house: "Casa",
    apartment: "Apartamento",
    townhouse: "Casa adosada",
    aBusiness: "Un negocio",
    whatAndWhere: "Qué y dónde",
    where: "Dónde",
    whichBusiness: "¿Qué negocio?",
    whichHome: "¿Qué casa?",
    differentBusiness: "Otro negocio",
    differentHome: "Otra casa",
    premisesUnit: "Suite, piso o unidad (opcional)",
    homeUnit: "Apartamento o unidad (opcional)",
    street: "Dirección",
    zip: "Código postal",
    fullName: "Nombre completo",
    phone: "Teléfono",
    area: "Área en pies cuadrados (opcional)",
    areaNote:
      "Más o menos cuánto hay que hacer. Si no está seguro, lo medimos en nuestra visita.",
    addNote: "Agregar una nota",
    notes: "¿Algo más que debamos saber?",
    condition: "¿Cuánta limpieza necesita?",
    extras: "¿Algún adicional?",
    extrasGone:
      "Algunos de los adicionales que eligió ya no se ofrecen. Revise lo que eligió.",
    pets: "Hay mascotas en la casa",
    howOften: "¿Con qué frecuencia?",
    regularNote: "Los mismos días cada semana",
    regularly: "Regularmente",
    oneOff: "Una vez",
    whichDays: "¿Qué días?",
    startTime: "Hora de inicio preferida",
    chooseTime: "Elija una hora",
    typesFailed: `No pudimos cargar los tipos de negocio. ${CALL_US.es}`,
    typeOfBusiness: "Tipo de negocio",
    chooseOne: "Elija uno",
    addFloorArea: "Agregar la superficie",
    floorArea: "Superficie en pies cuadrados (opcional)",
    floorAreaNote:
      "Un aproximado está bien. Si no está seguro, la medimos en nuestra visita.",
    addAccess: "Agregar cómo entramos",
    access: "¿Cómo entramos? (opcional)",
    bedrooms: "Dormitorios",
    studio: "0 para un estudio",
    bathrooms: "Baños",
    halfBaths: "Un medio baño cuenta como 0.5",
    floors: "Pisos",
    step: (at: number, of: number) => `Paso ${at} de ${of}`,
    back: "Atrás",
    next: "Siguiente",
  },
});

export type OwnWords = (typeof words)["en"]["own"];

// the form as the Office fills it in for a caller (#34, #96): about them, not
// to them, in English
export const officeWords: OwnWords = {
  need: "What they need",
  service: "What can we help them with?",
  servicesFailed: "The services didn't load. Please try again.",
  what: "What kind of place is it?",
  details: "Who's calling",
  email: "Email (optional)",
  emailNote:
    "Their quote is emailed here. Without an email, it can't be sent until one is added.",
  phoneNote: "Their cleaners can reach them on the day.",
  home: "Their home",
  premises: "Their business",
  when: "When would they like us to clean?",
  extrasNote: "Optional. The quote shows what each one costs.",
  regular:
    "After their first clean, they'd like regular visits (weekly, bi-weekly or monthly) at 10% off.",
  submit: "Draft a quote",
  businessName: "Business name",
  contactNote: "The person we'll deal with at the business.",
  failed: "The request didn't save. Please try again.",
};

// the help under "How do we get in?", for each kind of place; the Client's
// page for a home says it too
export const accessHelp = catalog<Record<PropertyKind, string>>({
  en: {
    residential:
      "Door codes, where the key is, parking. Only your cleaners see this.",
    commercial:
      "Alarm codes, who has the keys, parking. Only your cleaners see this.",
  },
  es: {
    residential:
      "Códigos de la puerta, dónde está la llave, estacionamiento. Solo sus limpiadores lo ven.",
    commercial:
      "Códigos de alarma, quién tiene las llaves, estacionamiento. Solo sus limpiadores lo ven.",
  },
});

// how much cleaning a place needs, as asked here and wherever the Office
// records it
export const conditions = catalog<
  { value: Condition; label: string; description: string }[]
>({
  en: [
    {
      value: "light",
      label: "Light",
      description: "Tidy, with everyday dust and marks",
    },
    {
      value: "moderate",
      label: "Moderate",
      description: "Lived in, with some build-up in the kitchen and bathrooms",
    },
    {
      value: "heavy",
      label: "Heavy",
      description:
        "Not cleaned in a while, or after a move, renovation or party",
    },
  ],
  es: [
    {
      value: "light",
      label: "Ligera",
      description: "Ordenada, con el polvo y las marcas de todos los días",
    },
    {
      value: "moderate",
      label: "Moderada",
      description: "Con uso, y algo de suciedad en la cocina y los baños",
    },
    {
      value: "heavy",
      label: "Intensa",
      description:
        "Sin limpiar desde hace tiempo, o después de una mudanza, una obra o una fiesta",
    },
  ],
});

import { catalog } from "@empire-cleaning/models";

// The landing site's own words, those its components say whatever the page
// (ADR-0025): each page's own are in its content module (areas, service
// pages, guides, FAQs, the business). The Spanish is a draft the owner
// checks (#206). A page's words are words[languageOf(Astro.currentLocale)].
export const words = catalog({
  en: {
    signIn: "Sign in",
    home: "Home",
    breadcrumbs: "Breadcrumbs",
    slogan: ["Clean spaces.", "Stronger impact."],
    promise: "Exceptional results, every visit.",
    call: (phone: string) => `Call ${phone}`,
    services: {
      title: "What we clean",
      intro:
        "Homes, offices and everything in between, done properly the first time.",
    },
    reviews: {
      title: "What our clients say",
      label: "Reviews",
      strip: "Reviews, one at a time",
      // "2 of 5"; the script says the same as it moves
      of: "of",
      previous: "Previous review",
      next: "Next review",
      all: "Read all our reviews on Google",
    },
    why: {
      title: "Why Empire",
      serving: (area: string) => `Serving ${area}`,
      // the crew speaks Spanish; said in Spanish, for those it's for
      spanish: "Se habla español.",
      points: [
        {
          name: "Trusted and reliable",
          text: "We turn up when we say we will, every time.",
        },
        {
          name: "Attention to every detail",
          text: "The corners, edges and surfaces others miss.",
        },
        {
          name: "Professional and insured",
          text: "Trained, insured cleaners you can let into your home.",
        },
      ],
    },
    howItWorks: {
      title: "How it works",
      steps: [
        "Tell us about your place in a few minutes. No account or sign-up needed.",
        "We email you a price. We recommend a deep clean first, or choose a lighter standard clean if you prefer.",
        "Accept online and pay a deposit to secure your date. The rest is charged once the clean is done.",
      ],
      // the first step's name is the Request a quote button's
      names: ["Get your quote", "Book with a deposit"],
    },
    quote: {
      noAccount: "No account needed.",
      preferToTalk: "Prefer to talk? Call us on",
      // once it's sent
      thanks: "Thanks, we've got your request",
      // with JavaScript off, in its place: before and after the phone number
      callUs: ["Call us on", "and we'll put your quote together."],
    },
    plans: {
      title: "Save 10% with a cleaning plan",
      lead: "Keep it clean, for less.",
      text: "After your first clean, choose weekly, bi-weekly or monthly visits and every one is 10% off. Skip a visit or end your plan whenever you need to.",
    },
    faqs: "Questions we're asked",
    relatedServices: "Related services",
    ourServices: "Our services",
    footer: {
      areas: "Areas we serve",
      online: "Find us online",
      on: (network: string) => `Empire Cleaning on ${network}`,
      spanish: "Se habla español",
    },
    // for the search data
    cleaningServices: "Cleaning services",
    houseCleaning: "House cleaning",
  },
  es: {
    signIn: "Iniciar sesión",
    home: "Inicio",
    breadcrumbs: "Ruta de navegación",
    slogan: ["Espacios limpios.", "Mayor impacto."],
    promise: "Resultados excepcionales en cada visita.",
    call: (phone: string) => `Llame al ${phone}`,
    services: {
      title: "Lo que limpiamos",
      intro:
        "Casas, oficinas y todo lo demás, bien hecho desde la primera vez.",
    },
    reviews: {
      title: "Lo que dicen nuestros clientes",
      label: "Reseñas",
      strip: "Reseñas, una a la vez",
      of: "de",
      previous: "Reseña anterior",
      next: "Reseña siguiente",
      all: "Lea todas nuestras reseñas en Google",
    },
    why: {
      title: "Por qué Empire",
      serving: (area: string) => `Limpiamos en ${area}`,
      // a Spanish page needn't say it
      spanish: "",
      points: [
        {
          name: "De confianza",
          text: "Llegamos cuando decimos que vamos a llegar, siempre.",
        },
        {
          name: "Atención a cada detalle",
          text: "Los rincones, bordes y superficies que otros pasan por alto.",
        },
        {
          name: "Profesionales y asegurados",
          text: "Limpiadores capacitados y asegurados a quienes puede abrirles la puerta de su casa.",
        },
      ],
    },
    howItWorks: {
      title: "Cómo funciona",
      steps: [
        "Cuéntenos de su lugar en unos minutos. No necesita crear una cuenta.",
        "Le enviamos un precio por correo. Le recomendamos empezar con una limpieza profunda, o elija una limpieza estándar más ligera si lo prefiere.",
        "Acepte en línea y pague un depósito para reservar su fecha. El resto se cobra cuando la limpieza está terminada.",
      ],
      names: ["Reciba su cotización", "Reserve con un depósito"],
    },
    quote: {
      noAccount: "No necesita crear una cuenta.",
      preferToTalk: "¿Prefiere hablar? Llámenos al",
      thanks: "Gracias, recibimos su solicitud",
      callUs: ["Llámenos al", "y le preparamos su cotización."],
    },
    plans: {
      title: "Ahorre un 10% con un plan de limpieza",
      lead: "Su casa limpia, por menos.",
      text: "Después de su primera limpieza, elija visitas semanales, cada dos semanas o mensuales, y cada una tiene un 10% de descuento. Sáltese una visita o termine su plan cuando lo necesite.",
    },
    faqs: "Preguntas frecuentes",
    relatedServices: "Servicios relacionados",
    ourServices: "Nuestros servicios",
    footer: {
      areas: "Zonas donde limpiamos",
      online: "Encuéntrenos en línea",
      on: (network: string) => `Empire Cleaning en ${network}`,
      spanish: "",
    },
    cleaningServices: "Servicios de limpieza",
    houseCleaning: "Limpieza de casas",
  },
});

import {
  CANCELLATION_CUTOFF_HOURS as CUTOFF,
  messages,
} from "@empire-cleaning/models";
import { business } from "../business.ts";
import { deposito, reprogramarOCancelar } from "../faqs.es.ts";
import type { LegalWords } from "./index.ts";

const said = messages.es;
const { phone, email } = business;

// terms.ts in Spanish, usted to the reader: a draft the owner checks (#206)
export const terms: LegalWords = {
  description:
    "Cómo funcionan en Empire Cleaning las cotizaciones, los depósitos, reprogramar y cancelar una limpieza, los cargos, los pagos y los reembolsos.",
  sections: [
    {
      title: "Cotizaciones",
      text: [
        "Cada cotización se calcula para su casa o negocio. Se la enviamos por correo electrónico y usted la acepta en su cuenta. Dice lo que incluye, el precio y por cuánto tiempo está abierta.",
        said.PRICES_INCLUDE_TAX,
        `Una cotización no se puede aceptar con menos de ${CUTOFF} horas de anticipación.`,
      ],
    },
    {
      title: "Su depósito",
      text: [
        deposito.answer,
        "No se reserva nada hasta que se paga el depósito.",
        `Lo paga con tarjeta. ${said.NEVER_SEE_CARD}`,
        `Al pagar, se guarda su tarjeta. Como dice el formulario: “${said.cardConsent(true)}”`,
      ],
    },
    {
      title: "Cambios de precio el día de la limpieza",
      text: [
        "Si el equipo hace un adicional que no estaba en su cotización, o la limpieza tarda más, le pedimos que apruebe el cambio de precio en su cuenta. No se cobra nada más si no lo aprueba.",
        "Un adicional de su cotización que no se hizo se descuenta del precio.",
      ],
    },
    {
      title: "Reprogramar o cancelar una limpieza",
      text: [
        "Puede hacer las dos cosas desde su cuenta. Una reprogramación espera a que confirmemos la nueva hora.",
        reprogramarOCancelar,
        "Una segunda reprogramación tardía de la misma limpieza es una cancelación tardía: el depósito se conserva como cargo, y el precio completo se cobra cuando la limpieza está terminada.",
        "Si cancela a tiempo, se le devuelve su depósito, y también si nosotros cancelamos la limpieza.",
      ],
    },
    {
      title: "Si no pudimos entrar",
      text: [
        "Si el equipo no puede entrar, la limpieza no se hace y se cobra como una cancelación tardía: el depósito se conserva como cargo por no poder entrar.",
      ],
    },
    {
      title: "Planes de limpieza",
      text: [
        "Cuando ya limpiamos para usted, o visitamos el lugar si el servicio lo necesita, puede tener un plan de limpieza, con visitas cada semana, cada 2 semanas o cada 4 semanas, con el descuento que aparece en su cotización. Cada limpieza se cobra cuando está terminada. Para cambiar su plan, pídanos una nueva cotización.",
        `Saltar una limpieza sigue las reglas para cancelar. Con menos de ${CUTOFF} horas de anticipación, o si no pudimos entrar, hay un cargo igual al depósito de su plan, y su depósito sigue retenido.`,
        `Puede terminar su plan cuando quiera. Sus limpiezas a ${CUTOFF} horas o más se cancelan gratis, y las más cercanas siguen en pie. Su depósito se aplica a su última limpieza, y se le reembolsa lo que sobre.`,
        `Si no podemos cobrar un pago de su plan, le pediremos que ${said.UPDATE_AND_RETRY}. ${said.PLAN_PAUSED}`,
      ],
    },
    {
      title: "Facturas semanales para negocios",
      text: [
        "Podemos facturar a un negocio una vez por semana: todo lo de la semana, de lunes a domingo, va en una factura que se hace el lunes siguiente. Se cobra a su tarjeta guardada o, si así lo acordamos, la paga en su página antes de su fecha límite, con tarjeta o desde su cuenta bancaria de EE. UU.",
      ],
    },
    {
      title: "Reembolsos",
      text: [
        `Lo que le debemos, como el depósito de una limpieza cancelada a tiempo, se reembolsa a la tarjeta con la que pagó. ${said.REFUND_TAKES_DAYS}`,
      ],
    },
    {
      title: "Preguntas",
      text: [
        `Llámenos al ${phone.display} o escríbanos a ${email.address}, y le ayudamos.`,
      ],
    },
  ],
};

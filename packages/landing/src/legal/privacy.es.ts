import { business } from "../business.ts";
import type { LegalWords } from "./index.ts";

const { phone, email } = business;

// privacy.ts in Spanish, usted to the reader: a draft the owner checks (#206)
export const privacy: LegalWords = {
  description:
    "Lo que Empire Cleaning guarda sobre usted, para qué, quién más lo ve y cómo pedir que se borre.",
  sections: [
    {
      title: "Quiénes somos",
      text: [
        `${business.name} limpia casas y negocios en Queens, Brooklyn, Manhattan, Nassau y parte de Suffolk, Nueva York. Esta política cubre nuestro sitio web y la aplicación donde los clientes inician sesión.`,
        `Si tiene preguntas sobre ella, llámenos al ${phone.display} o escríbanos a ${email.address}.`,
      ],
    },
    {
      title: "Lo que guardamos, y para qué",
      text: [
        "Solo lo que necesitamos para hacer cotizaciones, limpiar y cobrar:",
      ],
      list: [
        "Su nombre, correo electrónico y teléfono, y el nombre de su negocio si lo tiene, para enviarle cotizaciones y comunicarnos con usted sobre sus limpiezas.",
        "La dirección de cada lugar que limpiamos, sus habitaciones o su tamaño, si hay mascotas y cuánta limpieza necesita, para ponerle precio y planear el tiempo.",
        "Cómo entramos, por ejemplo dónde está la llave o un código de la puerta, como usted nos lo diga.",
        "Lo que pide en una cotización y las notas que agregue, con la página de nuestro sitio web desde la que la pidió y el enlace que lo trajo, para saber cómo nos encuentra la gente.",
        "Sus limpiezas: cuándo son, quién limpió, qué se hizo y cualquier cambio de precio.",
        "Sus pagos, reembolsos y facturas, y la marca y los últimos 4 dígitos de su tarjeta. El número completo de su tarjeta o cuenta bancaria va directo a Stripe, nuestro servicio de pagos: nunca lo vemos.",
        "Su idioma, para escribirle en inglés o en español.",
        "Cuando inicia sesión: su correo electrónico y, con Google, el nombre y la foto de su cuenta de Google. Cada inicio de sesión anota la dirección de internet y el navegador de su dispositivo, para proteger su cuenta.",
      ],
    },
    {
      title: "Quién lo ve",
      text: [
        "Nunca vendemos sus datos. Nuestra oficina los ve, para atender sus limpiezas.",
        "Los limpiadores a quienes ofrecemos una limpieza ven su dirección, cómo entramos y lo que hay que hacer. Ven su número de teléfono el día de la limpieza.",
        "Estas empresas manejan partes de nuestro sitio web y de la aplicación por nosotros, y cada una recibe solo lo que su parte necesita:",
      ],
      list: [
        "Stripe recibe los pagos con tarjeta y desde el banco, y guarda su tarjeta.",
        "Resend envía nuestros correos.",
        "Twilio envía nuestros mensajes de texto.",
        "Render aloja nuestro sitio web, la aplicación y sus registros.",
        "Google le permite iniciar sesión, si elige Continuar con Google.",
        "Sentry nos avisa cuando algo falla. Recibe un número que representa su cuenta, nunca su nombre, correo electrónico, teléfono ni dirección, y no graba su pantalla.",
        "Cloudflare cuenta las visitas a nuestro sitio web, sin cookies y sin saber quién es usted.",
      ],
    },
    {
      title: "Mensajes de texto",
      text: [
        "Si nos da un número de celular, podemos enviarle mensajes de texto sobre sus limpiezas y cotizaciones, por ejemplo un recordatorio el día antes o una limpieza que se movió. Darnos su número es la forma de aceptarlos. Cada mensaje de texto le llega también por correo electrónico.",
        `Responda STOP a cualquier mensaje para dejar de recibirlos, y START para recibirlos de nuevo. Responda HELP para pedir ayuda, o llámenos al ${phone.display}. Pueden aplicarse tarifas de mensajes y datos. Cuántos mensajes recibe depende de sus limpiezas.`,
        "No enviamos mensajes de texto entre las 9 p.m. y las 8 a.m., hora de Nueva York.",
        "Nunca compartimos ni vendemos su número de teléfono, ni que aceptó recibir mensajes de texto, para el marketing de nadie.",
      ],
    },
    {
      title: "Cookies",
      text: [
        "Nuestro sitio web no usa ninguna. La aplicación usa una, para mantener su sesión iniciada, y el formulario de pago pone las de Stripe, para detectar fraudes. Su navegador recuerda si eligió el modo claro u oscuro, y su idioma.",
      ],
    },
    {
      title: "Cuánto tiempo lo guardamos",
      text: [
        "Guardamos sus datos mientras limpiamos para usted, y los registros de limpiezas, pagos y facturas mientras nuestra contabilidad los necesite.",
      ],
    },
    {
      title: "Ver, cambiar o borrar sus datos",
      text: [
        "Puede ver y cambiar sus datos, y cómo entramos, en la aplicación.",
        `Para que borremos sus datos, escríbanos a ${email.address} o llámenos al ${phone.display}. Borramos su correo electrónico, su teléfono, cómo entramos y su tarjeta guardada, y quitamos su nombre de lo que guardamos. Guardamos lo que necesita nuestra contabilidad: sus limpiezas, pagos y facturas.`,
      ],
    },
    {
      title: "Cambios",
      text: [
        "Si cambiamos esta política, pondremos la nueva aquí, con la fecha en que entra en vigor.",
      ],
    },
  ],
};

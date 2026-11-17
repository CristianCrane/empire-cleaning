import { business } from "../business.ts";
import type { LegalPage } from "./index.ts";

const { phone, email } = business;

// what we keep about Clients and visitors, and who sees it (#462): only what
// the app stores (the server's *.schema.ts files) and the services it sends
// to. The owner checks it on #206; it isn't legal advice. Its Spanish is
// privacy.es.ts
export const privacy: LegalPage = {
  key: "privacy",
  effective: "2026-11-17",
  description:
    "What Empire Cleaning keeps about you, why, who else sees it, and how to have it deleted.",
  sections: [
    {
      title: "Who we are",
      text: [
        `${business.name} cleans homes and businesses in Queens, Brooklyn, Manhattan, Nassau and parts of Suffolk, New York. This policy covers our website and the app where clients sign in.`,
        `Questions about it go to us: call ${phone.display} or email ${email.address}.`,
      ],
    },
    {
      title: "What we keep, and why",
      text: ["Only what we need to quote, clean and get paid:"],
      list: [
        "Your name, email and phone, and your business's name if you have one, to send you quotes and reach you about your cleans.",
        "The address of each place we clean, its rooms or size, any pets and how much cleaning it needs, to price it and plan the time.",
        "How we get in, such as where the key is or a door code, as you tell us.",
        "What you ask for in a quote and any notes you add, with the page of our website you asked from and the link that brought you there, so we know how people find us.",
        "Your cleans: when they are, who cleaned, what was done and any price changes.",
        "Your payments, refunds and bills, and your card's brand and last 4 digits. Your full card or bank account number goes straight to Stripe, our payment service: we never see it.",
        "Your language, so we write to you in English or Spanish.",
        "When you sign in: your email, and with Google, the name and picture on your Google account. Each sign-in notes your device's internet address and browser, to keep your account safe.",
      ],
    },
    {
      title: "Who sees it",
      text: [
        "We never sell your details. Our office sees them, to look after your cleans.",
        // what a Cleaner sees today (assignments.ts); when they see how we get
        // in waits on the owner (#230): change this line, and its twin, with it
        "The cleaners we offer a clean to see your first name, its address, how we get in and what's to be done. They see your phone number on the day of the clean.",
        "These companies run parts of our website and app for us, and each gets only what its part needs:",
      ],
      list: [
        "Stripe takes card and bank payments, and keeps your card.",
        "Resend sends our emails.",
        "Twilio sends our texts.",
        "Render hosts our website, the app and its records.",
        "Google signs you in, if you choose Continue with Google.",
        "Sentry tells us when something breaks. It gets a number that stands for your account, never your name, email, phone or address, and it doesn't record your screen.",
        "Cloudflare counts visits to our website, with no cookies and without knowing who you are.",
      ],
    },
    {
      title: "Texts",
      // worded so it holds before texts go live (#211) and after
      text: [
        "If you give us a mobile number, we may text you about your cleans and quotes, such as a reminder the day before or a clean that moved. Giving us your number is how you agree to them. Every text also comes as an email.",
        `Reply STOP to any text to stop them, and START to get them again. Reply HELP for help, or call us on ${phone.display}. Message and data rates may apply. How many texts you get depends on your cleans.`,
        "We don't send texts between 9pm and 8am New York time.",
        "We never share or sell your phone number, or that you agreed to texts, for anyone's marketing.",
      ],
    },
    {
      title: "Cookies",
      text: [
        "Our website uses none. The app uses one, to keep you signed in, and the payment form sets Stripe's own, to spot fraud. Your browser remembers whether you chose light or dark, and your language.",
      ],
    },
    {
      title: "How long we keep it",
      text: [
        "We keep your details while we clean for you, and the records of cleans, payments and bills for as long as our books need them.",
      ],
    },
    {
      title: "Seeing, changing or deleting your details",
      // what deleting does is #231's proposal, waiting on the owner: change
      // this part, and its twin, with it
      text: [
        "You can see and change your details, and how we get in, in the app.",
        `To have your details deleted, email ${email.address} or call ${phone.display}. We delete your email, phone, how we get in and your saved card, and take your name off what we keep. We keep what our books need: your cleans, payments and bills.`,
      ],
    },
    {
      title: "Changes",
      text: [
        "If we change this policy, we'll put the new one here, with the date it takes effect.",
      ],
    },
  ],
};

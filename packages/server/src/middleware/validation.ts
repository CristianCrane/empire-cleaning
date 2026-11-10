import type { RequestHandler } from "express";
import { z } from "zod";
import { type Catalog, catalog, formats } from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import {
  PathParameterError,
  QueryParameterError,
  RequestBodyError,
} from "./errors.ts";

type ValidationMiddlewareOptions<TParamsSchema, TBodySchema, TQuerySchema> = {
  params?: TParamsSchema;
  body?: TBodySchema;
  query?: TQuerySchema;
};

// checks a request's params, body and query against their schemas, and hands
// the handlers after it what each schema made of them (numbers, trimmed
// strings), typed so: they read req.params, req.body and req.query, never
// parse them again
export const validate =
  <TParams, TBody, TQuery>({
    params: paramsSchema,
    body: bodySchema,
    query: querySchema,
  }: ValidationMiddlewareOptions<
    z.ZodSchema<TParams>,
    z.ZodSchema<TBody>,
    z.ZodSchema<TQuery>
  >): RequestHandler<TParams, unknown, TBody, TQuery> =>
  (req, _res, next) => {
    if (paramsSchema) {
      const result = paramsSchema.safeParse(req.params);
      if (!result.success) {
        throw new PathParameterError(result.error);
      }
      req.params = result.data;
    }

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        throw new RequestBodyError(result.error);
      }
      req.body = result.data;
    }

    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) {
        throw new QueryParameterError(result.error);
      }
      // Express 5's req.query is a getter that parses the URL afresh each
      // time: this one on the request hides it, writable and configurable
      // as a plain property is, so another validate can set it again
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };

// A schema's message, in the language of the request it checks
// (ADR-0025): worked out as each request is checked, not once when the
// schema is made. `key` names one of `words`' messages. A message only the
// Office reads stays a plain English string
type MessageKey<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];
export const say = <T>(words: Catalog<T>, key: MessageKey<T>) => ({
  error: () => words[currentLanguage()][key] as string,
});

// what a too-long text field says, in the request's language: "Keep the
// reason under 500 characters". Each field is named in either language
type Field =
  | "it"
  | "the name"
  | "the business name"
  | "the street address"
  | "the unit"
  | "the description"
  | "the reason"
  | "the note"
  | "the notes";
const keepUnderWords = catalog({
  en: {
    keepUnder: (n: string, what: Field) => `Keep ${what} under ${n} characters`,
  },
  // impersonal, as Clients (usted) and Cleaners (tú) both read it
  es: {
    keepUnder: (n: string, what: Field) =>
      `${what === "it" ? "Debe" : fieldsEs[what]} tener menos de ${n} caracteres`,
  },
});
// each field and its verb, which agrees with it
const fieldsEs: Record<Exclude<Field, "it">, string> = {
  "the name": "El nombre debe",
  "the business name": "El nombre del negocio debe",
  "the street address": "La dirección debe",
  "the unit": "El apartamento o la unidad debe",
  "the description": "La descripción debe",
  "the reason": "El motivo debe",
  "the note": "La nota debe",
  "the notes": "Las notas deben",
};
export const keepUnder = (max: number, what: Field = "it") => ({
  error: () => {
    const lang = currentLanguage();
    return keepUnderWords[lang].keepUnder(
      formats[lang].formatNumber(max),
      what,
    );
  },
});

// what picking a day or a time says; a Quote request's days say it too
export const pickerWords = catalog({
  en: { pickDay: "Pick a day", pickStartTime: "Pick a start time" },
  es: { pickDay: "Elija un día", pickStartTime: "Elija una hora de inicio" },
});

// a day and a start time a person picks, New York
export const day = z.iso.date(say(pickerWords, "pickDay"));
export const startTime = z
  .string(say(pickerWords, "pickStartTime"))
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, say(pickerWords, "pickStartTime"));

// a route's one path param, the id of what it's about: /:id
export const byId = z.object({ id: z.uuid() });

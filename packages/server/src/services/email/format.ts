// how emails write names; money, times and days are models' (`formats`)

export const firstNameOf = (name: string) => name.split(" ")[0]!;

// a Spanish sentence with a time in it: es-US writes "9:00 a.m.", so one
// that ends a sentence, or a plan's days before one ends, takes no second
// stop ("a las 9:00 a.m.", not "a.m..")
export const oneStop = (sentence: string) => sentence.replaceAll("..", ".");

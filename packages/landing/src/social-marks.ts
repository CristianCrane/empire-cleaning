import {
  siFacebook,
  siGoogle,
  siInstagram,
  siYelp,
  type SimpleIcon,
} from "simple-icons";
import type { business } from "./business.ts";

// each of the business's pages elsewhere (business.social) has its
// network's mark, which the footer shows in one colour (#223). Here, not in
// Footer.astro, as the typecheck skips .astro files (#226): a page added
// without its mark fails it
export const marks: Record<keyof typeof business.social, SimpleIcon> = {
  facebook: siFacebook,
  instagram: siInstagram,
  yelp: siYelp,
  google: siGoogle,
};

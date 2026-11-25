import { prototype } from "../prototype.ts";

// the public site's home page (#505): the hero leads with what we clean and
// where; the open pick is the header's shape, and whether the slogan stays
export default prototype({
  layouts: [
    { key: "bar", name: "Slim bar" },
    { key: "none", name: "No bar" },
    { key: "sticky", name: "Bar that stays, with Call" },
  ],
  cases: {
    slogan: { name: "Whole page, slogan under the buttons" },
    plain: { name: "First screen, no slogan" },
    landed: { name: "Landed at the form, from a link" },
    spanish: { name: "Spanish, whole page, slogan", lang: "es" },
  },
});

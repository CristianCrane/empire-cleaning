import { withAppUrl, type Email } from "./blocks.ts";
import { EmailLayout, logoUrlOn } from "./layout.tsx";

// an email as `pnpm email:dev` shows it, with its links into the local app and
// the logo from the local landing site:
// each file in emails/ is `export default preview(someEmail({ …sample }))`
export const preview = (email: Email) => {
  const Preview = () => (
    <EmailLayout
      email={withAppUrl(email, "http://localhost:5173")}
      logoUrl={logoUrlOn("http://localhost:4321")}
    />
  );
  return Preview;
};

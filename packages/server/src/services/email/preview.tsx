import { withAppUrl, type Email } from "./blocks.ts";
import { EmailLayout } from "./layout.tsx";

// an email as `pnpm email:dev` shows it, with its links into the local app:
// each file in emails/ is `export default preview(someEmail({ …sample }))`
export const preview = (email: Email) => {
  const Preview = () => (
    <EmailLayout email={withAppUrl(email, "http://localhost:5173")} />
  );
  return Preview;
};

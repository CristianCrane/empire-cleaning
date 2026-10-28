import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

export const reminderEmail = ({
  name,
  clean,
}: {
  name: string;
  clean: Clean;
}): Email => ({
  subject: "Your clean is tomorrow",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("A reminder that your clean is tomorrow."),
    cleanDetails(clean),
    paragraph(
      "Please make sure our team can get in. If anything has changed, such as a gate code or where the key is, update your Access Instructions:",
    ),
    button("Check your Access Instructions", "/portal/details"),
  ],
});

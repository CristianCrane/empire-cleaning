import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

// a clean coming up, as its Client is reminded, and how they put right how we
// get in; the caller ends the sentence
export const CAN_GET_IN =
  "Please make sure our team can get in. If anything has changed, such as a gate code or where the key is, update how we get in";

// where a Client puts it right, from any email that asks them to check it
export const accessButton = button("Check how we get in", "/portal/details");

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
    paragraph(`${CAN_GET_IN}:`),
    accessButton,
  ],
});

import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { Button } from "./Button.tsx";
import { Form } from "./Form.tsx";
import { TextField } from "./TextField.tsx";

test("an error goes as soon as the field is fixed, not on blur", async () => {
  const screen = await render(
    <Form onSubmit={(e) => e.preventDefault()}>
      <TextField label="ZIP code" isRequired />
      <Button type="submit">Next</Button>
    </Form>,
  );
  const zip = screen.getByRole("textbox", { name: "ZIP code" });

  await screen.getByRole("button", { name: "Next" }).click();
  await expect.element(zip).toHaveAttribute("aria-invalid", "true");

  await userEvent.type(zip, "11375");

  // still focused, and the message has gone
  await expect.element(zip).toHaveFocus();
  await expect.element(zip).not.toHaveAttribute("aria-invalid");
});

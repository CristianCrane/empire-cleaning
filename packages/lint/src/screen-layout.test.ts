import { RuleTester } from "oxlint/plugins-dev";
import rule from "./screen-layout.ts";

const tsx = { filename: "screen.tsx" };
const kit =
  'import { ActionFooter, Breadcrumbs, Heading } from "@empire-cleaning/ui";';
const ownPart = [{ messageId: "ownPart" }];
const ownFacts = [{ messageId: "ownFacts" }];

new RuleTester().run("screen-layout", rule, {
  valid: [
    // through a layout, which places the parts itself
    {
      code: `import { MessagePage } from "@empire-cleaning/ui";
        const a = <MessagePage title="Page not found" icon={SearchX} home={home}><p>Gone.</p></MessagePage>;`,
      ...tsx,
    },
    // a heading under the page's title
    { code: `${kit} const a = <Heading level={2}>Crew</Heading>;`, ...tsx },
    {
      code: `${kit} const a = <Heading level={3} size={4}>Crew</Heading>;`,
      ...tsx,
    },
    // a component of the screen's own that happens to share a part's name
    {
      code: `function Breadcrumbs() { return null } const a = <Breadcrumbs />;`,
      ...tsx,
    },
    // a list of amounts, a receipt rather than facts
    {
      code: `const a = <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm"><dt>Total</dt><dd>$1</dd></dl>;`,
      ...tsx,
    },
    // a dl not laid out as a grid
    {
      code: `const a = <dl className="flex flex-col gap-1 text-sm"><dt>Total</dt><dd>$1</dd></dl>;`,
      ...tsx,
    },
    // the kit's other parts
    {
      code: `import { Card, Section } from "@empire-cleaning/ui"; const a = <Section title="Crew"><Card /></Section>;`,
      ...tsx,
    },
  ],
  invalid: [
    // each of the page's parts, placed by the screen
    {
      code: `${kit} const a = <Breadcrumbs items={[{ label: "Jobs", href }]} />;`,
      ...tsx,
      errors: ownPart,
    },
    {
      code: `${kit} const a = <ActionFooter aria-label="Send"><Button>Send</Button></ActionFooter>;`,
      ...tsx,
      errors: ownPart,
    },
    {
      code: `${kit} const a = <Heading level={1}>Job</Heading>;`,
      ...tsx,
      errors: ownPart,
    },
    {
      code: `${kit} const a = <Heading level={1} inBar>Jobs</Heading>;`,
      ...tsx,
      errors: ownPart,
    },
    { code: `const a = <h1>Job</h1>;`, ...tsx, errors: ownPart },
    // under another name, or through the kit's namespace
    {
      code: `import { Breadcrumbs as Crumbs } from "@empire-cleaning/ui"; const a = <Crumbs items={[]} />;`,
      ...tsx,
      errors: ownPart,
    },
    {
      code: `import * as ui from "@empire-cleaning/ui"; const a = <ui.Heading level={1}>Job</ui.Heading>;`,
      ...tsx,
      errors: ownPart,
    },
    // the facts grid, in each way it's written today: icon-led facts across,
    // label-first facts, and the classes in another order
    {
      code: `const a = <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4"><Fact /></dl>;`,
      ...tsx,
      errors: ownFacts,
    },
    {
      code: `const a = <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]"><dt>Fee</dt><dd>None</dd></dl>;`,
      ...tsx,
      errors: ownFacts,
    },
    {
      code: "const a = <dl className={`grid grid-cols-[auto_1fr] gap-x-6 gap-y-2`}><dt>From</dt><dd>9am</dd></dl>;",
      ...tsx,
      errors: ownFacts,
    },
    // a title row: every part on its own
    {
      code: `${kit} const a = <><Breadcrumbs items={[]} /><Heading level={1}>Job</Heading></>;`,
      ...tsx,
      errors: [...ownPart, ...ownPart],
    },
  ],
});

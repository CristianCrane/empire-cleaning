import { RuleTester } from "oxlint/plugins-dev";
import rule from "./report-unexpected.ts";

// RuleTester names the rule rule-to-test/…, so a disable comment for
// empire/report-unexpected is shown by `pnpm lint` itself (ui stored.ts)

const options = [{ reporters: ["reportUnexpected"] }];
const unreported = [{ messageId: "unreported" }];

new RuleTester().run("report-unexpected", rule, {
  valid: [
    // each place a caught error is handled, reporting it
    {
      code: "try { f() } catch (e) { reportUnexpected(e) }",
      options,
    },
    { code: "p.catch(reportUnexpected)", options },
    { code: "p.catch((e) => reportUnexpected(e))", options },
    {
      code: "p.catch(function (e) { reportUnexpected(e); return null })",
      options,
    },
    {
      code: "p.then(ok, (e) => { reportUnexpected(e); return false })",
      options,
    },
    // or rethrowing it
    { code: "try { f() } catch (e) { tidy(); throw e }", options },
    { code: "p.catch((e) => { throw e })", options },
    // a call in a branch counts: the rule doesn't follow every path
    {
      code: "try { f() } catch (e) { if (e.status) show(e); else reportUnexpected(e) }",
      options,
    },
    // a one-argument .then catches nothing
    { code: "p.then((v) => set(v))", options },
    // each package's own reporter
    {
      code: "try { f() } catch (e) { reportError(e) }",
      options: [{ reporters: ["reportError"] }],
    },
  ],
  invalid: [
    { code: "try { f() } catch { }", options, errors: unreported },
    { code: "try { f() } catch (e) { show(e) }", options, errors: unreported },
    { code: "p.catch(() => {})", options, errors: unreported },
    { code: "p.catch(() => null)", options, errors: unreported },
    { code: "p.catch(console.error)", options, errors: unreported },
    { code: "p.catch(notLoaded)", options, errors: unreported },
    { code: "p.then(ok, () => false)", options, errors: unreported },
    // another package's reporter: web's reportError would send the API's
    // answers too, which reportUnexpected skips
    {
      code: "try { f() } catch (e) { reportError(e) }",
      options,
      errors: unreported,
    },
    // a report inside a function the handler makes may never run
    {
      code: "try { f() } catch (e) { later(() => reportUnexpected(e)) }",
      options,
      errors: unreported,
    },
    // with no reporters set, only a throw handles it
    {
      code: "try { f() } catch (e) { reportUnexpected(e) }",
      errors: unreported,
    },
  ],
});

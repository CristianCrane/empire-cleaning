// the test site's build (render.yaml) says so on every page and asks search
// engines to stay away (ADR-0020)
export const isTestSite = import.meta.env.PUBLIC_APP_MODE === "test";

# Design system

The components the web app and landing site use (React Aria underneath); a screen never uses `react-aria-components` or raw colours (`src/index.ts`'s header). Its entries:

- `@empire-cleaning/ui`: components and styles
- `@empire-cleaning/ui/tokens.css`: styles alone, for a page without React
- `@empire-cleaning/ui/theme`: the ThemeToggle alone, for an island
- `@empire-cleaning/ui/language`: the design system's language alone, for an island
- `@empire-cleaning/ui/feedback.css`: Sentry's feedback button's look, which each site places
- `@empire-cleaning/ui/theme-boot`: the head script applying a chosen dark theme before first paint
- `@empire-cleaning/ui/fonts`: the first screen's font files, for a page to preload

An app compiles the styles with its own Tailwind (`@tailwindcss/vite`). New colours, type and sizes go in `tokens.css` only; Tailwind's palette is off.

## Catalogue

```sh
pnpm --filter @empire-cleaning/ui storybook
```

On http://localhost:6006, every component in every state; the toolbar switches theme and viewport, and the Accessibility panel shows the checks. Stories sit beside each component (`*.stories.tsx`), the layouts' under Layout.

## Testing

```sh
pnpm --filter @empire-cleaning/ui test
```

In a real Chromium (Vitest browser mode), at 414px by default. Every story is a test, in light and dark, playing its `play` and running axe, which fails on any violation. Component tests (`*.test.tsx`, `vitest-browser-react`) cover what a story can't show.

### Browser setup (once per machine)

```sh
pnpm --filter @empire-cleaning/ui test:install-browser
```

On Ubuntu, Debian or CI: `npx playwright install --with-deps chromium`. On NixOS, Playwright's Chromium needs `programs.nix-ld.enable = true` and these libraries in your NixOS config:

```nix
programs.nix-ld.libraries = with pkgs; [
  alsa-lib at-spi2-atk at-spi2-core atk dbus expat glib libgbm
  libxkbcommon nspr nss systemd
  libx11 libxcb libxcomposite libxdamage libxext libxfixes libxrandr
];
```

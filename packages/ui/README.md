# Design system

`@empire-cleaning/ui` is the one look shared by the web app (`packages/web`) and the landing site (`packages/landing`). Screens use its components, never `react-aria-components` or raw colours directly.

- `@empire-cleaning/ui`: the components (and the styles, imported once by the app).
- `@empire-cleaning/ui/tokens.css`: just the styles, for pages without React (the landing site).
- `@empire-cleaning/ui/theme`: just the ThemeToggle, so an island ships only that.
- `@empire-cleaning/ui/theme-boot`: the inline `<head>` script that applies a pinned theme before first paint.

Apps compile the styles with their own Tailwind (`@tailwindcss/vite`); `tokens.css` points Tailwind at this package's sources.

- **Tokens** live in one file, `tokens.css`: colours (each written once as `light-dark(<light>, <dark>)`), type, radii and the 44px touch size. Components use semantic Tailwind utilities (`bg-surface`, `text-fg-muted`, `bg-primary`), so they work in both themes automatically. Tailwind's own palette is switched off, so an off-brand colour can't slip in.
- **Brand**: the green, charcoal and ink from the Empire Cleaning logo. Barlow for reading, and Barlow Condensed in capitals for headings.
- **Components** are built on [React Aria Components](https://react-spectrum.adobe.com/react-aria/), which handles keyboard, screen reader and touch behaviour: Button, Link, Breadcrumbs, TextField, NumberField, Checkbox, RadioGroup, Select, DatePicker, TimeField, Calendar, Form and Actions, Table, List, Card, Heading, StatusBadge, Notice, Dialog, Toast, AppLayout and ThemeToggle. EmbeddedField frames an input that belongs to someone else, such as the payment provider's card box, so it looks and reads like the other fields.
- **Links and routing**: `Link` and AppLayout's nav navigate through the app's router. The app wraps itself in `RouterProvider` and declares its link type by augmenting `RouterConfig` on `@empire-cleaning/ui`; the web app does this in `packages/web/src/links.ts`.
- **Actions**: put the main action last. On a phone it stacks at the bottom, nearest the thumb; on larger screens it sits on the right.
- **Phone first**: tap targets are at least 44px, fields use 16px text (so phones don't zoom in), dialogs rise as bottom sheets, and AppLayout puts navigation in a bottom tab bar on phones and a sidebar from tablet width up. Use List for collections on a phone and Table for wide Office data.
- **Theme** follows the device unless someone pins light or dark with the ThemeToggle, and each device remembers that choice.

## Catalogue

```sh
pnpm --filter @empire-cleaning/ui storybook
```

Storybook runs on http://localhost:6006 and shows every component in every state. Use the toolbar to switch theme and viewport, and the Accessibility panel to see the checks. Each component's stories sit next to it in `*.stories.tsx`.

## Testing

Every test runs in a real Chromium through Playwright (Vitest browser mode), never a simulated DOM. Vitest's default frame is 414px wide, so everything is also tested at phone width.

- **Component tests** (`*.test.tsx`) cover behaviour and layout that stories can't show well, using `vitest-browser-react`. `tokens.test.tsx` checks that every text and background pair meets WCAG AA contrast in both themes.
- **Every story is also a test**, run twice: once in the light theme and once in dark. Each run renders the story, plays its `play` interactions, and runs an axe accessibility check that fails on any violation, including contrast, labels, landmarks and heading order.

```sh
pnpm --filter @empire-cleaning/ui test    # or `pnpm test` at the root for every package
```

### Browser setup (once per machine)

```sh
pnpm --filter @empire-cleaning/ui test:install-browser
```

On Ubuntu, Debian or CI, use `npx playwright install --with-deps chromium` instead, which also installs the system libraries.

On NixOS, Playwright's downloaded Chromium needs `programs.nix-ld.enable = true` and these libraries in your NixOS config (not the project):

```nix
programs.nix-ld.libraries = with pkgs; [
  alsa-lib at-spi2-atk at-spi2-core atk dbus expat glib libgbm
  libxkbcommon nspr nss systemd
  libx11 libxcb libxcomposite libxdamage libxext libxfixes libxrandr
];
```

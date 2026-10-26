import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**",
    // SST infra config (not app source; also excluded in tsconfig). Its required
    // triple-slash reference to the generated ambient globals can't be an import.
    "sst.config.ts",
    ".sst/**",
    // Generated build/type artifacts - not linted.
    ".open-next/**",
    "sst-env.d.ts",
  ]),
  // Icon-only buttons have one standard (CLAUDE.md, "Icon-only buttons"):
  // <IconButton label> - the label is both the accessible name and the
  // tooltip, which on touch opens on a long press. Before it, one table row
  // could hold a native `title`, a styled tooltip and no hint at all side by
  // side. The agreed exceptions (the close X of dialogs, sheets and drawers,
  // quantity +/- and calendar month arrows) carry an eslint-disable with the
  // reason, so every other one has to say why it is special.
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/IconButton.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // Reported on the <Button> tag itself, so an exception's
          // eslint-disable comment sits right above the element it excuses.
          selector:
            "JSXOpeningElement[name.name='Button']:has(> JSXAttribute[name.name='size'][value.value=/^icon/])",
          message:
            'Icon-only buttons use <IconButton label="..."> - one label for the tooltip and the accessible name. See CLAUDE.md, "Icon-only buttons".',
        },
      ],
    },
  },
]);

export default eslintConfig;

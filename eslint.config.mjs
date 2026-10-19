import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"

export default defineConfig([
  {
    linterOptions: {
      // A disable comment that suppresses nothing hides nothing — fail on it.
      reportUnusedDisableDirectives: "error",
    },
  },
  ...nextVitals,
  {
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      // React 19 correctness rules — on, and kept at zero violations.
      "react-hooks/immutability": "error",
      "react-hooks/purity": "error",
      "react-hooks/error-boundaries": "error",
      "react-hooks/static-components": "error",
      // Derived/seeded state is adjusted during render (lib/utils/deps-changed.ts);
      // effects only sync with things outside React. The few real ones (timers,
      // localStorage, object URLs, window.location) carry a disable comment with
      // the reason — reportUnusedDisableDirectives keeps those honest.
      "react-hooks/set-state-in-effect": "error",
      // Off, with reasons:
      // - incompatible-library flags library APIs (react-hook-form `watch`, etc.)
      //   that the React Compiler cannot optimise; nothing to fix on our side.
      // - preserve-manual-memoization only matters once the React Compiler is on.
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react/no-unescaped-entities": "warn",
      "import/no-anonymous-default-export": "off",
      "@next/next/no-img-element": "warn",
      "prefer-const": "error",
      // Use lib/logger (structured, namespaced) — raw console output is lost in prod.
      "no-console": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='useEffect'] > ArrowFunctionExpression > BlockStatement > ExpressionStatement > CallExpression[callee.object.name='fetch']",
          message: "Do not fetch data inside useEffect. Use useQuery from @tanstack/react-query instead.",
        },
        {
          selector:
            "CallExpression[callee.property.name='split'][callee.object.type='CallExpression'][callee.object.callee.property.name='toISOString']",
          message:
            "Do not derive business dates/times from toISOString(); use toLocalISODate(), toLocalYearMonth(), or toLocalTimeString() from '@/lib/utils/date'.",
        },
        {
          selector:
            "CallExpression[callee.property.name='slice'][callee.object.type='CallExpression'][callee.object.callee.property.name='toISOString']",
          message:
            "Do not derive business dates/times from toISOString(); use toLocalISODate(), toLocalYearMonth(), or toLocalTimeString() from '@/lib/utils/date'.",
        },
      ],
    },
  },
  {
    // next/og image routes can only render a plain <img>. The Next plugin already
    // skips these files, but it matches them with a forward-slash path, so on
    // Windows the rule still fires; a disable comment then reads as "unused" on
    // Linux CI. Turning the rule off here is correct on both.
    files: ["app/**/opengraph-image.tsx", "app/**/twitter-image.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  // ---------------------------------------------------------------------------
  // AGENTS.md enforcement: admin & dept client components must NOT query
  // Supabase directly from the browser — it bypasses middleware scope injection
  // (no x-admin-scope / x-dept-scope header). They must call a scoped /api route.
  // ---------------------------------------------------------------------------
  {
    files: ["app/admin/**/*.{ts,tsx}", "app/dept/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/client",
              message:
                "Admin/dept client components must not query Supabase directly (bypasses middleware scope injection). Fetch a scoped /api route that calls getRequestScope() instead — see AGENTS.md 'Admin Route Scoping Standard'.",
            },
          ],
        },
      ],
    },
  },
  {
    // The logger itself writes to the console; tests and the next-themes warning
    // filter (theme-provider) legitimately touch it too.
    files: [
      "lib/logger.ts",
      "**/__tests__/**",
      "components/theme-provider.tsx",
      "e2e/**",
      "*.config.*",
      // Deno edge functions and the standalone document service log to stdout by design.
      "supabase/functions/**",
      "services/**",
    ],
    rules: { "no-console": "off" },
  },
  globalIgnores(["scripts/**"]),
])

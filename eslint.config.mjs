import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"

export default defineConfig([
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  ...nextVitals,
  {
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "warn",
      "import/no-anonymous-default-export": "off",
      "@next/next/no-img-element": "warn",
      "prefer-const": "error",
      "no-restricted-syntax": [
        "warn",
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
  globalIgnores(["scripts/**"]),
])

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Allow unused variables for now (can be cleaned up later)
      "@typescript-eslint/no-unused-vars": "warn",
      // Allow any types for Monaco Editor integration
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unescaped entities in JSX
      "react/no-unescaped-entities": "off",
      // Allow empty interfaces
      "@typescript-eslint/no-empty-object-type": "off",
      // Allow prefer-const warnings
      "prefer-const": "warn",
      // Allow missing dependencies in useEffect
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;

import nextJest from "next/jest.js";

// next/jest lets Jest understand TypeScript using Next.js's own compiler.
const createJestConfig = nextJest({ dir: "./" });

export default createJestConfig({
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
});

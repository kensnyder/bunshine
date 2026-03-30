# Agent Guide for Multibyte

This `bunshine` monorepo is focused on creating a fast HTTP server based on Bun's HTTP & Websocket server APIs. Handlers receive a context function that allows reading native `Request` objects and returning native `Response` objects.

## General

- **CRITICAL:** When you read these guidelines, say "I read AGENTS.md".
- **Git:** DO NOT BRANCH OR COMMIT without user review.
- **Support:** Consult docs/web for weak knowledge; ask if tasks are ambiguous or you're stuck (large files/output).
- **Environment:** Use `./temp` for temporary files.
- **Runtime:** Use `bun`, `bunx` and `bunx --bun`. DO NOT use `node`, `npm` or `npx` without user approval.

### Repository File Structure
- `/src`: Core logic. Each Unicode-safe function is implemented in its own file.
- `/tests`: Unit tests corresponding to each source file.
- `index.ts`: Main entry point exporting all public functions from `src/`.
- `/dist`: Generated build artifacts (CommonJS, ESM, and type definitions).
- `package.json`: Scripts, devDependencies (bun:test, esbuild, TypeScript), and metadata.
- `bun.lockb` & `tsconfig.json`: Environment and compiler configuration.

### Commands and Tools
- `bun run build`: Generates ESM, CJS, and DTS files using `bun build`.
- `bun run lint`: Checks formatting, imports and lint rules using `biome`.
- `bun run format`: Formats all files in the project using `biome`.
- `bun test`: Executes the complete test suite using `bun:test`.
- `bun test --watch`: Runs tests in watch mode for active development.
- `bun run coverage`: Generates reports via `bun test --coverage`.
- `bun run build:clean`: Removes the `dist/` directory to ensure a fresh build.

### Coding Style Rules

- **Formatting:** Single statement per line. Explicit braces for `if`/`for`/`while` on new lines. No `return` on the same line as logic.
- **Logic:** Avoid nested ternaries. Max 80 chars for ternary lines; otherwise use `if` blocks.
- **Arguments:** Functions that need 3+ input values should accept 1 argument object with named properties.
- **Functional Approach**: Export standalone pure functions instead of modifying prototypes.
- **Immutability**: Never modify input parameters; always return derived values.
- **TypeScript:** Avoid `any`/`as any`; use `unknown` or proper interfaces.
- **CLI:** If building CLI tools, use `import { parseArgs } from "node:util"`.
- **Inline Documentation:** Write clear, concise comments. Use JSDoc for public APIs.
- **Markdown:** Organize with structured headings. Avoid using bold text for section titles or list titles.

## Style / Code Layout

- Avoid placing `return` statements on the same line as preceding logic.
- Always use explicit braces for `if`, `for`, `while` and put the following code on a new line.
- Avoid `any` and `as any` in TypeScript when possible.
- Avoid logic that uses nested ternary operators. Use `if` blocks instead.
- Lines that use ternary operators should be 80 characters or fewer. For longer lines, use `if` blocks instead.
- Each statement should occupy its own line (no multi-statement single lines).
- Unless otherwise told, assume a Bun JavaScript runtime
- Prefer Bun native functions to external packages
- For tests, use `import { describe, it, test } from 'bun:test';`.

# Bunshine

A Bun HTTP & WebSocket server that is a little ray of sunshine.

<img alt="Bunshine Logo" src="https://github.com/kensnyder/bunshine/raw/main/packages/bunshine/assets/bunshine-logo.png?v=3.0.0" width="200" height="187" />

This GitHub repository is a monorepo for Bunshine. Packages are:

- [bunshine](./packages/bunshine/README.md) - The main Bunshine HTTP Server package
- [connect-to-fetch](./packages/connect-to-fetch/README.md) - A package to use [connect-style middleware](https://github.com/senchalabs/connect) such as an [Express](https://expressjs.com/) middleware with Fetch environments such as `Bun.serve`, `Deno.serve`, and Cloudflare Workers
- [bunshine-connect](./packages/bunshine-connect/README.md) - A package that uses `connect-to-fetch` with Bunshine

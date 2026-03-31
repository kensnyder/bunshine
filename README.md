# Bunshine Monorepo

An HTTP server that is a little ray of sunshine.

Originally designed just for Bun, this monorepo houses Bunshine and packages for running compatible servers on Node and Cloudflare Workers.

<img alt="Bunshine Logo" src="https://github.com/kensnyder/bunshine/raw/main/packages/bunshine/assets/bunshine-logo.png?v=3.0.0" width="200" height="187" />

## Packages

The following power npm packages with the same name.

- [bunshine](./packages/bunshine/README.md) - The original Bunshine HTTP Server package
- [cloudshine](./packages/cloudshine/README.md) - Compatible with Cloudflare Workers
- [nodeshine](./packages/cloudshine/README.md) - Compatible with Node
- [connect-to-fetch](./packages/connect-to-fetch/README.md) - A package to use [connect-style middleware](https://github.com/senchalabs/connect) such as an [Express](https://expressjs.com/) middleware with Fetch environments such as `Bun.serve`, `Deno.serve`, and Cloudflare Workers

The following are supporting packages 

- [routeshine](./packages/routeshine/README.md) - The handler and middleware runner common to other packages
- [react-router-shine](./packages/react-router-bunshine/README.md) - Use Remix+Vite with `bunshine` or `nodeshine`.

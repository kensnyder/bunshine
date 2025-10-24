# Changelog

## v3.6.1 - Oct 24, 2025

- Fixes and enhancements to etags middleware
- Add zstd compression support in `compression` middleware

## v3.5.1 - Oct 14, 2025

- Update deps
- Expose response creation shorthand functions such as jsonResponse(data, init?)
- Add Context.took(precision) function to return milliseconds since request start

## v3.4.2 - June 18, 2025

- Update deps
- Add wasm to list of unambiguous content types

## v3.4.0 - Feb 3, 2025

- `compression` middleware now supports compressing streaming responses

## v3.3.5 - Jan 29, 2025

- Add `exceptWhen` option to `compression`, `etags`, `serveFiles`, `devLogger`, and `prodLogger`
- Add `maxSize` option to `etags`
- Add `writer` option to `devLogger` and `prodLogger`
- Use long-form type definition for `on404` and `on500` within `HttpRouter`

## v3.2.4 - Jan 13, 2025

- Avoid etags when body is a stream

## v3.2.3 - Jan 13, 2025

- `c.sse()` to support multi-line messages
- Accommodate Bun 1.1.43 bugfix to HEAD content-length header
- Avoid compression when body is a stream
- Add `maxSize` option to compression middleware (default 2GB)
- Add LRU cache for file-based mime detection

## v3.2.2 - Dec 7, 2024

- Fix mime-type on css

## v3.2.1 - Dec 2, 2024

- Update dependencies to allow minor version changes
- Docs improvements
- Align `Handler` and `Middleware` type definitions

## v3.2.0 - Nov 29, 2024

- Auto-detect file mime type with `c.file()`
- Properly match fixed paths
- Fix TypeScript types for HTTPS configuration
- Support `If-Modified-Since` header
- Tweaks to range header handling

## v3.1.2 - Nov 25, 2024

- Change default range chunk size 3MB => 1MB
- Support passing headers to `c.file()`

## v3.1.1 - Nov 23, 2024

- Fix `Content-Range` header when file size is 0

## v3.1.0 - Nov 23, 2024

- Remove useless exports of response factories
- More unit tests
- Fixes to file range handling

## v3.0.0

- The `securityHeaders` middleware has been discontinued. Use a library such as
  [@side/fortifyjs](https://www.npmjs.com/package/@side/fortifyjs) instead.
- The `serveFiles` middleware no longer accepts options for `etags` or `gzip`.
  Instead, compose the `etags` and `compression` middlewares:
  `app.headGet('/files/*', etags(), compression(), serveFiles(...))`

## v2.0.0

- `RegExp` symbols are not allowed in route definitions to avoid ReDoS
  vulnerabilities.

## v1.0.0

- Initial stable release

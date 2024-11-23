# Changelog

## v3.1.0

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

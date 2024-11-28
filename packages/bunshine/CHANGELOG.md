# Changelog

## v3.2.0 - Nov xx, 2024

- Auto-detect file mime type with c.file()
- Properly match fixed paths
- Tweaks to range header handling

## v3.1.2 - Nov 25, 2024

- Change default range chunk size 3MB => 1MB
- Support passing headers to c.file()

## v3.1.1 - Nov 23, 2024

- Fix Content-Range header when file size is 0

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

import { Readable } from 'stream';

function fetchToConnect(fetchHandler) {
  return async function (req, res, next) {
    // Convert Node.js request to Fetch API Request
    const fetchRequest = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body:
        req.method !== 'GET' && req.method !== 'HEAD'
          ? Readable.toWeb(req)
          : undefined,
    });

    try {
      const fetchResponse = await fetchHandler(fetchRequest);

      // Set status code and headers
      res.statusCode = fetchResponse.status;
      fetchResponse.headers.forEach((value, name) => {
        res.setHeader(name, value);
      });

      // Stream the response body
      if (fetchResponse.body) {
        const nodeStream = Readable.fromWeb(fetchResponse.body);
        nodeStream.pipe(res);
        nodeStream.on('end', () => res.end());
      } else {
        res.end();
      }
    } catch (error) {
      next(error);
    }
  };
}

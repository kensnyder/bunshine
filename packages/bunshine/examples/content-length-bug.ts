const server = Bun.serve({
  fetch() {
    return new Response(null, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': '1000',
      },
    });
  },
});

const resp = await fetch(server.url, { method: 'HEAD' });

// should be 1000, but is actually 0
const contentLength = resp.headers.get('Content-Length');
console.log(`Content-length=${contentLength}`);

server.stop(true);

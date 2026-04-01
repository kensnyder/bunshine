import { HttpRouter } from '../index';

const app = new HttpRouter();

app.get('/', c =>
  c.json({
    message: 'Hello, World!',
    ip: c.ip,
    runtime: 'Node.js via nodeshine',
  })
);

app.get('/hello/:name', c => c.text(`Hello, ${c.params.name}!`));

app.get('/headers', c =>
  c.json(Object.fromEntries(c.request.headers.entries()))
);

const server = await app.listen({ port: 4286 });
const address = server.address() as { port: number };
console.log(`Listening on http://localhost:${address.port}`);

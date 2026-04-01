import { HttpRouter } from '../index';

interface Env {
  GREETING: string;
}

const app = new HttpRouter<Env>();

app.get('/', c =>
  c.json({
    message: `${c.env.GREETING ?? 'Hello'}, World!`,
    ip: c.ip,
    runtime: 'Cloudflare Workers via cloudshine',
  })
);

app.get('/hello/:name', c =>
  c.text(`${c.env.GREETING ?? 'Hello'}, ${c.params.name}!`)
);

app.get('/headers', c =>
  c.json(Object.fromEntries(c.request.headers.entries()))
);

export default app;

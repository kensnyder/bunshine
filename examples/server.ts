import { HttpRouter } from '../index';

const app = new HttpRouter();

app.get('/favicon.ico', c =>
  c.file(`${import.meta.dir}/../assets/favicon.ico`)
);
app.get('/', c => c.text('Hello World'));
app.get('/bye', c => c.html('<h1>Bye World</h1>'));
app.get('/json', c => c.json({ hello: 'world' }));
app.get('/js', c => c.js('alert("Hello World")'));
app.get('/file', c => c.file(`${import.meta.dir}/server.ts`));
app.post('/parrot', async c =>
  c.json({
    receivedJson: await c.request.json(),
    withHeaders: Object.fromEntries(c.request.headers),
  })
);

app.listen();
app.emitUrl();

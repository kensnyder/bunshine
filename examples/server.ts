import { HttpRouter } from '../index';

const app = new HttpRouter();

app.get('/', c => c.text('Hello World'));
app.get('/bye', c => c.html('<h1>Bye World</h1>'));

app.listen();
app.emitUrl();

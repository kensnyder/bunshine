import { HttpRouter } from '../index';

const app = new HttpRouter();

app.get('/', c => c.text('Hello World'));

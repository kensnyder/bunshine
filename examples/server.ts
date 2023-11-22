import Router from '../index';

const app = new Router();

app.get('/', c => c.text('Hello World'));

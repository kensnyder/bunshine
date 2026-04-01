import { describe, expect, it } from 'bun:test';
import HttpRouter from './HttpRouter';

describe('CfwHttpRouter', () => {
  const mockCtx = { waitUntil: () => {}, passThroughOnException: () => {} };

  it('handles a basic GET /', async () => {
    const router = new HttpRouter();
    router.get('/', c => c.text('Hello'));
    const response = await router.fetch(
      new Request('http://localhost/'),
      {},
      mockCtx
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Hello');
  });

  it('returns 404 for unregistered routes', async () => {
    const router = new HttpRouter();
    const response = await router.fetch(
      new Request('http://localhost/missing'),
      {},
      mockCtx
    );
    expect(response.status).toBe(404);
  });

  it('exposes env on context', async () => {
    type Env = { SECRET: string };
    const router = new HttpRouter<Env>();
    router.get('/secret', c => c.text(c.env.SECRET));
    const response = await router.fetch(
      new Request('http://localhost/secret'),
      { SECRET: 'hunter2' },
      mockCtx
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('hunter2');
  });

  it('exposes ip from CF-Connecting-IP header', async () => {
    const router = new HttpRouter();
    router.get('/ip', c => c.text(c.ip ?? 'none'));
    const response = await router.fetch(
      new Request('http://localhost/ip', {
        headers: { 'CF-Connecting-IP': '1.2.3.4' },
      }),
      {},
      mockCtx
    );
    expect(await response.text()).toBe('1.2.3.4');
  });

  it('dispatches route params correctly', async () => {
    const router = new HttpRouter();
    router.get('/users/:id', c => c.text(c.params.id));
    const response = await router.fetch(
      new Request('http://localhost/users/42'),
      {},
      mockCtx
    );
    expect(await response.text()).toBe('42');
  });
});

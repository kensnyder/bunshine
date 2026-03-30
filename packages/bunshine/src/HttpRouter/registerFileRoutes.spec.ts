import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HttpRouter from './HttpRouter';
import { sortRoutes } from './registerFileRoutes';

describe('registerFileRoutes', () => {
  let app: HttpRouter;
  let server: Server<any>;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen({ port: 0 });
  });
  afterEach(() => {
    app.close(true);
  });
  it('should support file routing', async () => {
    // Files are users.ts, users.$id.ts, users.me.ts
    await app.registerFileRoutes({
      path: `${import.meta.dir}/../../testFixtures/fileRoutes`,
    });
    // GET /users
    const users = await fetch(`${server.url}/users`).then(r => r.text());
    expect(users).toBe('List of users');
    // POST /users
    const newUser = await fetch(`${server.url}/users`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Charlie' }),
    }).then(r => r.text());
    expect(newUser).toBe('Created user with {"name":"Charlie"}');
    // GET /users/2
    const user2 = await fetch(`${server.url}/users/2`).then(r => r.text());
    expect(user2).toBe('Get user id=2');
    // GET /users/me
    const me = await fetch(`${server.url}/users/me`);
    expect(me.headers.get('took')).toMatch(/^\d+$/);
    expect(await me.text()).toBe('Me');
    // GET /other
    const splat = await fetch(`${server.url}/other`);
    expect(await splat.text()).toBe('$splat');
  });
});

describe('sortBySpecificity', () => {
  it('should sort with all rules', () => {
    const routes = [
      { path: '/users/:id', method: 'ALL' as const },
      { path: '/users/:id', method: 'GET' as const },
      { path: '*', method: 'GET' as const },
      { path: '/users/me', method: 'GET' as const },
      { path: '/:lang/me', method: 'GET' as const },
    ];
    expect(sortRoutes(routes)).toEqual([
      { path: '/users/me', method: 'GET' },
      { path: '/users/:id', method: 'GET' },
      { path: '/users/:id', method: 'ALL' },
      { path: '/:lang/me', method: 'GET' },
      { path: '*', method: 'GET' },
    ]);
  });
});

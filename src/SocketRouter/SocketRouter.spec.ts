import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import HttpRouter from '../HttpRouter/HttpRouter';

describe('server', () => {
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
  });
  afterEach(() => {
    server.stop(true);
  });
  it('should connect ok', async () => {
    const result = await new Promise((resolve, reject) => {
      app.socket.at<{ room: string }>('/chat/:room', {
        upgrade() {
          return { fruit: 'apple' };
        },
        open(sc) {
          sc.data.open = true;
        },
        message(sc, request) {
          resolve({
            fruit: sc.data.fruit,
            room: sc.params.room,
            type: sc.type,
            open: sc.data.open,
            message: request.text(),
          });
        },
      });
      server = app.listen({ port: 7774 });
      const chat = new WebSocket(`${server.url}chat/123`);
      chat.addEventListener('open', evt => {
        chat.send('hello');
      });
      chat.addEventListener('error', reject);
    });
    expect(result).toEqual({
      fruit: 'apple',
      room: '123',
      type: 'message',
      open: true,
      message: 'hello',
    });
  });
  it('should send buffers ok', async () => {
    const result: Buffer = await new Promise((resolve, reject) => {
      app.socket.at<{ room: string }>('/chat/:room', {
        open(sc) {
          sc.send(Buffer.from('hello'));
        },
      });
      server = app.listen({ port: 7775 });
      const chat = new WebSocket(`${server.url}chat/123`);
      chat.addEventListener('message', evt => {
        resolve(evt.data);
      });
    });
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toEqual('hello');
  });
  it('should send array buffers ok', async () => {
    const result: ArrayBuffer = await new Promise((resolve, reject) => {
      app.socket.at<{ room: string }>('/chat/:room', {
        open(sc) {
          sc.send(Buffer.from('hello').buffer);
        },
      });
      server = app.listen({ port: 7776 });
      const chat = new WebSocket(`${server.url}chat/123`);
      chat.addEventListener('message', evt => {
        resolve(evt.data);
      });
    });
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toEqual('hello');
  });
  it('should send JSON ok', async () => {
    const result = await new Promise((resolve, reject) => {
      app.socket.at<{ room: string }>('/chat/:room', {
        open(sc) {
          sc.send({ hello: 'world' });
        },
      });
      server = app.listen({ port: 7777 });
      const chat = new WebSocket(`${server.url}chat/123`);
      chat.addEventListener('message', evt => {
        resolve(JSON.parse(evt.data));
      });
    });
    expect(result).toEqual({ hello: 'world' });
  });
  it('should upgrade http requests and pass messages', async () => {
    const result = await new Promise((resolve, reject) => {
      let s: Server;
      const result: any = [];
      app.socket.at<{ id: string }>('/chat/:id', {
        upgrade(c) {
          s = c.server;
          return { fruit: 'apple' };
        },
        open(sc) {
          result.push({
            type: sc.type,
            fruit: sc.data.fruit,
            id: sc.params.id,
            pathname: sc.url.pathname,
            isServer: sc.server === s,
          });
        },
        message(sc, request) {
          result.push({
            type: sc.type,
            fruit: sc.data.fruit,
            id: sc.params.id,
            pathname: sc.url.pathname,
            isServer: sc.server === s,
            message: request.text(),
          });
          sc.send('world');
        },
      });
      server = app.listen({ port: 7778 });
      const chat = new WebSocket(`${server.url}chat/123`);
      chat.addEventListener('open', evt => {
        chat.send('hello');
      });
      chat.addEventListener('message', evt => {
        result.push({ message: evt.data });
        resolve(result);
      });
      chat.addEventListener('error', evt => {
        console.log('client error!', evt);
        reject();
      });
    });
    expect(result).toEqual([
      {
        type: 'open',
        fruit: 'apple',
        id: '123',
        pathname: '/chat/123',
        isServer: true,
      },
      {
        type: 'message',
        fruit: 'apple',
        id: '123',
        pathname: '/chat/123',
        isServer: true,
        message: 'hello',
      },
      {
        message: 'world',
      },
    ]);
  });
  it('should handle errors', async () => {
    const errorData = await new Promise((resolve, reject) => {
      let data: Array<{ type: string; message: string }> = [];
      app.socket.at('/chat/:id', {
        error(sc, error) {
          data.push({ type: sc.type, message: error.message });
          if (data.length === 2) {
            resolve(data);
          }
        },
        open() {
          throw new Error('open!');
        },
        message() {
          throw new Error('message!');
        },
      });
      server = app.listen({ port: 7779 });
      const chat = new WebSocket(`${server.url}chat/123`);
      chat.addEventListener('open', evt => {
        chat.send('hello');
      });
    });
    expect(errorData).toEqual([
      { type: 'open', message: 'open!' },
      { type: 'message', message: 'message!' },
    ]);
  });
  it('should log unhandled errors', async () => {
    let message: string = '';
    const spy = spyOn(console, 'error').mockImplementation(m => {
      message = m;
    });
    app.socket.at('/chat/:id', {
      open() {
        throw new Error('open!');
      },
    });
    server = app.listen({ port: 7780 });
    new WebSocket(`${server.url}chat/123`);
    await new Promise(r => setTimeout(r, 10));
    expect(spy).toHaveBeenCalled();
    expect(message).toContain('Unhandled WebSocket handler error');
    spy.mockRestore();
  });
  it('should allow pub-sub', async () => {
    const [messages, events] = await new Promise<[string[], string[]]>(
      async resolve => {
        let messages: string[] = [];
        let events: string[] = [];
        app.socket.at<{ id: string; user: string }>('/chat/:id', {
          upgrade({ url, params }) {
            return {
              id: params.id,
              user: url.searchParams.get('user'),
            };
          },
          open(sc) {
            sc.subscribe(`room-${sc.data.id}`);
            sc.publish(
              `room-${sc.data.id}`,
              `${sc.data.user} entered the chat`
            );
            sc.send(`${sc.data.user} entered the chat`);
            events.push(`${sc.data.user} entered the chat`);
          },
          message(sc, message) {
            messages.push(message.text());
            sc.publish(`room-${sc.data.id}`, message.toString());
            sc.send(message.text());
          },
          close(sc) {
            sc.unsubscribe(`room-${sc.data.id}`);
            sc.publish(`room-${sc.data.id}`, `${sc.data.user} left the chat`);
            events.push(`${sc.data.user} left the chat`);
            if (events.length === 3 && messages.length === 2) {
              resolve([messages, events]);
            }
          },
          error(sc, error) {
            console.log('error', error);
          },
        });
        server = app.listen({ port: 7781 });
        const user1 = new WebSocket(`${server.url}chat/123?user=a`);
        const user2 = new WebSocket(`${server.url}chat/123?user=b`);
        await Promise.all([
          new Promise(r => user1.addEventListener('open', r)),
          new Promise(r => user2.addEventListener('open', r)),
        ]);
        user1.send('1.1');
        await new Promise(r => setTimeout(r, 10));
        server.publish(`room-123`, 'hello');
        await new Promise(r => setTimeout(r, 10));
        user2.send('2.1');
        await new Promise(r => setTimeout(r, 10));
        user2.close();
        await new Promise(r => setTimeout(r, 10));
        user1.send('1.2');
        await new Promise(r => setTimeout(r, 10));
        user2.close();
      }
    );
    // Note: we don't hear 1.2 because user2 is closed
    expect(messages).toEqual(['1.1', '2.1']);
    expect(events.includes('a entered the chat')).toBe(true);
    expect(events.includes('b entered the chat')).toBe(true);
    expect(events.includes('b left the chat')).toBe(true);
    // Note: we don't hear that "a left the chat"
    // because no one is subscribed to the room to hear it
  });
});

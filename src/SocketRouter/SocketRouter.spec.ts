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
  it('should connect ok', () => {
    return new Promise((resolve, reject) => {
      app.socket.at('/chat', {
        open() {
          resolve(null);
        },
      });
      server = app.listen({ port: 7774 });
      const chat = new WebSocket('http://localhost:7774/chat');
      chat.addEventListener('open', evt => {
        chat.send('hello');
      });
      chat.addEventListener('error', reject);
    });
  });
  it('should upgrade http requests and pass messages', () => {
    return new Promise((resolve, reject) => {
      let s: Server;
      app.socket.at('/chat/:id', {
        upgrade({ server }) {
          s = server;
          return { fruit: 'apple' };
        },
        open(ws) {
          expect(ws.data.fruit).toBe('apple');
          expect(ws.data.params.id).toBe('123');
          expect(ws.data.url.pathname).toBe('/chat/123');
          expect(ws.data.server).toBe(s);
        },
        message(ws, message) {
          expect(message.toString()).toBe('hello');
          expect(ws.data.fruit).toBe('apple');
          expect(ws.data.params.id).toBe('123');
          expect(ws.data.url.pathname).toBe('/chat/123');
          expect(ws.data.server).toBe(s);
          ws.sendText('world');
        },
      });
      server = app.listen({ port: 7774 });
      const chat = new WebSocket('http://localhost:7774/chat/123');
      chat.addEventListener('open', evt => {
        chat.send('hello');
      });
      chat.addEventListener('message', evt => {
        expect(String(evt.data)).toBe('world');
        resolve(null);
      });
      chat.addEventListener('error', evt => {
        console.log('client error!', evt);
        reject();
      });
    });
  });
  it('should handle errors', async () => {
    let errorData: Array<Record<string, string>> = [];
    app.socket.at('/chat/:id', {
      error(ws, eventName, error) {
        errorData.push({ eventName, message: error.message });
      },
      open() {
        throw new Error('open!');
      },
      message() {
        throw new Error('message!');
      },
    });
    server = app.listen({ port: 7774 });
    const chat = new WebSocket('http://localhost:7774/chat/123');
    chat.addEventListener('open', evt => {
      chat.send('hello');
    });
    await new Promise(r => setTimeout(r, 20));
    expect(errorData).toEqual([
      { eventName: 'open', message: 'open!' },
      { eventName: 'message', message: 'message!' },
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
    server = app.listen({ port: 7774 });
    new WebSocket('http://localhost:7774/chat/123');
    await new Promise(r => setTimeout(r, 10));
    expect(spy).toHaveBeenCalled();
    expect(message).toContain('Unhandled WebSocket handler error');
  });
  it('should allow pub-sub', async () => {
    let messages: string[] = [];
    let events: string[] = [];
    app.socket.at<{ id: string; user: string }>('/chat/:id', {
      upgrade({ url, params }) {
        return {
          id: params.id,
          user: url.searchParams.get('user'),
        };
      },
      open(ws) {
        ws.subscribe(`room-${ws.data.id}`);
        ws.publish(`room-${ws.data.id}`, `${ws.data.user} entered the chat`);
        events.push(`${ws.data.user} entered the chat`);
      },
      message(ws, message) {
        messages.push(message.toString());
        ws.publish(`room-${ws.data.id}`, message.toString());
      },
      close(ws) {
        ws.unsubscribe(`room-${ws.data.id}`);
        ws.publish(`room-${ws.data.id}`, `${ws.data.user} left the chat`);
        events.push(`${ws.data.user} left the chat`);
      },
    });
    server = app.listen({ port: 7774 });
    const user1 = new WebSocket('http://localhost:7774/chat/123?user=a');
    const user2 = new WebSocket('http://localhost:7774/chat/123?user=b');
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
    await new Promise(r => setTimeout(r, 10));
    expect(messages).toEqual(['1.1', '2.1', '1.2']);
    expect(events).toEqual([
      'a entered the chat',
      'b entered the chat',
      'b left the chat',
      // we don't hear that "a left the chat"
      // because no one is subscribed to the room to hear it
    ]);
  });
});

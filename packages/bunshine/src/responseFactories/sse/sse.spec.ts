import type { Server } from 'bun';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import EventSource from 'eventsource';
import HttpRouter from '../../HttpRouter/HttpRouter';

type SseTestEvent = {
  type: string;
  data: string;
  lastEventId?: string;
  origin?: string;
};

describe('sse', () => {
  let port = 50000;
  let app: HttpRouter;
  let server: Server;
  beforeEach(() => {
    app = new HttpRouter();
    server = app.listen({ port: port++ });
  });
  afterEach(() => {
    server.stop(true);
  });
  function sseTest({
    payloads,
    event,
    headers = {},
  }: {
    port: number;
    payloads:
      | Array<[string, any, string]>
      | Array<[string, any]>
      | Array<[string]>;
    event: string;
    headers?: Record<string, string>;
  }): Promise<SseTestEvent[]> {
    return new Promise((outerResolve, outerReject) => {
      const events: SseTestEvent[] = [];
      const readyToSend = new Promise((resolve, reject) => {
        app.get('/sse', c => {
          return c.sse(
            send => {
              resolve(() => {
                for (const payload of payloads) {
                  // @ts-expect-error
                  send(...payload);
                }
              });
            },
            { headers }
          );
        });
        app.onError(c => reject(c.error));
      }) as Promise<() => void>;
      const readyToListen = new Promise((resolve, reject) => {
        const stream = new EventSource(`${server.url}sse`);
        stream.addEventListener('error', evt => {
          reject(evt);
          stream.close();
        });
        stream.addEventListener(event, evt => {
          events.push(evt);
          if (events.length === payloads.length) {
            outerResolve(events);
            stream.close();
          }
        });
        resolve(port);
      }) as Promise<number>;
      Promise.all([readyToSend, readyToListen])
        .then(([doSend]) => doSend())
        .catch(outerReject);
    });
  }
  it('should handle unnamed data', async () => {
    const events = await sseTest({
      event: 'message',
      port: port++,
      payloads: [['Hello'], ['World']],
    });
    expect(events.length).toBe(2);
    expect(events[0].data).toBe('Hello');
    expect(events[1].data).toBe('World');
  });
  it('should send last event id and origin', async () => {
    const events = await sseTest({
      event: 'myEvent',
      port: port++,
      payloads: [
        ['myEvent', 'hi1', 'id1'],
        ['myEvent', 'hi2', 'id2'],
      ],
    });
    expect(events.length).toBe(2);
    expect(events[0].data).toBe('hi1');
    expect(events[1].data).toBe('hi2');
    expect(events[0].lastEventId).toBe('id1');
    expect(events[1].lastEventId).toBe('id2');
    expect(events[0].origin).toStartWith(`http://localhost:`);
    expect(events[0].origin).toBe(String(events[1].origin));
  });
  it('should JSON encode data if needed', async () => {
    const events = await sseTest({
      event: 'myEvent',
      port: port++,
      payloads: [['myEvent', { name: 'Bob' }]],
    });
    expect(events.length).toBe(1);
    expect(events[0].data).toBe('{"name":"Bob"}');
  });
  it('should warn when overriding some headers', async () => {
    spyOn(console, 'warn').mockImplementation(() => {});
    await sseTest({
      event: 'myEvent',
      port: port++,
      payloads: [['myEvent', { name: 'Bob' }]],
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'foo',
        Connection: 'whatever',
      },
    });
    expect(console.warn).toHaveBeenCalledTimes(3);
    // @ts-expect-error
    console.warn.mockRestore();
  });
  it('should not warn if those headers are correct', async () => {
    spyOn(console, 'warn').mockImplementation(() => {});
    await sseTest({
      event: 'myEvent',
      port: port++,
      payloads: [['myEvent', { name: 'Bob' }]],
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
    expect(console.warn).toHaveBeenCalledTimes(0);
    // @ts-expect-error
    console.warn.mockRestore();
  });
});

import { Hono } from 'hono';

export class CounterDurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(): Promise<Response> {
    const current = (await this.state.storage.get<number>('count')) ?? 0;
    const next = current + 1;
    await this.state.storage.put('count', next);

    return Response.json({ message: `Hello Hono ${next}!` });
  }
}

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.post('/api/hello', (c) => {
  const id = c.env.COUNTER.idFromName('global');
  const stub = c.env.COUNTER.get(id);
  return stub.fetch('https://counter.internal/increment');
});

export default app;

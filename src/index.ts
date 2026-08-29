import { Hono } from 'hono';

const app = new Hono();

app.post('/api/hello', (c) => {
  return c.json({ message: 'Hello Hono!' });
});

export default app;

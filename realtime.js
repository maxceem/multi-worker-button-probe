import { DurableObject } from 'cloudflare:workers';
export class ProbeSession extends DurableObject {
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Upgrade required', {status: 426});
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    server.addEventListener('message', event => server.send(this.env.RELEASE + ':' + event.data));
    server.addEventListener('close', () => { try { server.close(); } catch {} });
    return new Response(null, { status: 101, webSocket: client });
  }
}
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/health') return Response.json({release: env.RELEASE});
    if (new URL(request.url).pathname !== '/ws') return new Response('Not found', {status:404});
    return env.SESSIONS.get(env.SESSIONS.idFromName(new URL(request.url).searchParams.get('id') || 'probe')).fetch(request);
  }
};
// Second release for the live Workers Builds connection-survival test.

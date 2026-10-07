export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/health') return env.REALTIME.fetch('https://probe.invalid/health');
    return Response.json({ gatewayRevision: 2, release: env.RELEASE, websocket: env.REALTIME_URL + '/ws' });
  }
};
export function handleHealthRoute(response) {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ ok: true, service: 'agent-api' }));
}

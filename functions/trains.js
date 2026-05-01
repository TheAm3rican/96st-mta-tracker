export async function onRequest() {
  return new Response(JSON.stringify({ test: 'working' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

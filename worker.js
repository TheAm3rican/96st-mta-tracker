export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/debug') {
      try {
        const res = await fetch('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs');
        const buf = new Uint8Array(await res.arrayBuffer());
        const firstBytes = Array.from(buf.slice(0, 20))
          .map(b => b.toString(16).padStart(2, '0')).join(' ');
        return new Response(JSON.stringify({
          status: res.status,
          contentType: res.headers.get('content-type'),
          contentEncoding: res.headers.get('content-encoding'),
          size: buf.length,
          firstBytes
        }, null, 2), { headers: { 'Content-Type': 'application/json' } });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('ok');
  }
};

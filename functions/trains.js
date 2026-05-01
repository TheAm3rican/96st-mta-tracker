export async function onRequest() {
  const FEEDS = [
    { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs', stopId: '121S' },
    { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs-bdfm', stopId: 'A11S' },
    { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs-ace', stopId: 'A11S' },
  ];

  const LINE_COLORS = {
    '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
    'B': '#FF6319', 'C': '#0039A6',
  };

  function parseVarint(buf, pos) {
    let result = 0, shift = 0;
    while (pos < buf.length) {
      const b = buf[pos++];
      result += (b & 0x7f) * (2 ** shift);
      shift += 7;
      if (!(b & 0x80)) break;
    }
    return [result, pos];
  }

  function parseMessage(buf, start = 0, end = buf.length) {
    const fields = {};
    let pos = start;
    while (pos < end) {
      let tag; [tag, pos] = parseVarint(buf, pos);
      const fn = tag >>> 3;
      const wt = tag & 7;
      if (wt === 0) {
        let v; [v, pos] = parseVarint(buf, pos);
        fields[fn] = v;
      } else if (wt === 2) {
        let len; [len, pos] = parseVarint(buf, pos);
        if (!fields[fn]) fields[fn] = [];
        fields[fn].push(buf.slice(pos, pos + len));
        pos += len;
      } else if (wt === 1) { pos += 8; }
        else if (wt === 5) { pos += 4; }
        else break;
    }
    return fields;
  }

  const dec = new TextDecoder();
  const str = (b) => dec.decode(b);
  const now = Math.floor(Date.now() / 1000);
  const arrivals = [];

  await Promise.all(FEEDS.map(async (feed) => {
    try {
      const res = await fetch(feed.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      const feedMsg = parseMessage(buf);

      for (const entityBuf of (feedMsg[2] || [])) {
        const entity = parseMessage(entityBuf);
        if (!entity[3]?.[0]) continue;

        const tu = parseMessage(entity[3][0]);
        if (!tu[1]?.[0]) continue;

        const tripDesc = parseMessage(tu[1][0]);
        if (!tripDesc[5]?.[0]) continue;
        const routeId = str(tripDesc[5][0]);

        for (const stuBuf of (tu[2] || [])) {
          const stu = parseMessage(stuBuf);
          if (!stu[2]?.[0]) continue;
          if (str(stu[2][0]) !== feed.stopId) continue;

          const timeBuf = stu[3]?.[0] || stu[4]?.[0];
          if (!timeBuf) continue;

          const t = parseMessage(timeBuf)[2];
          if (!t || t < now) continue;

          arrivals.push({
            line: routeId,
            minutes: Math.round((t - now) / 60),
            color: LINE_COLORS[routeId] || '#888',
            timestamp: t * 1000,
          });
        }
      }
    } catch (e) {
      console.error(`Feed error: ${e.message}`);
    }
  }));

  arrivals.sort((a, b) => a.timestamp - b.timestamp);

  return new Response(
    JSON.stringify({ arrivals: arrivals.slice(0, 10), updated: Date.now() }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

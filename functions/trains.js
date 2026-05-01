function parseVarint(buf, pos) {
  let result = 0, shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    result += (b & 0x7f) * Math.pow(2, shift);
    shift += 7;
    if (!(b & 0x80)) break;
  }
  return [result, pos];
}

function parseProto(buf, start, end) {
  if (start === undefined) start = 0;
  if (end === undefined) end = buf.length;
  const fields = {};
  let pos = start;
  while (pos < end) {
    let tag;
    [tag, pos] = parseVarint(buf, pos);
    const fieldNum = tag >>> 3;
    const wireType = tag & 7;
    if (wireType === 0) {
      let val;
      [val, pos] = parseVarint(buf, pos);
      fields[fieldNum] = val;
    } else if (wireType === 2) {
      let len;
      [len, pos] = parseVarint(buf, pos);
      if (!fields[fieldNum]) fields[fieldNum] = [];
      fields[fieldNum].push(buf.slice(pos, pos + len));
      pos += len;
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return fields;
}

const decoder = new TextDecoder();
function str(bytes) { return decoder.decode(bytes); }

export async function onRequest() {
  const FEEDS = [
    { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs', stopId: '121S' },
    { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs-bdfm', stopId: 'A11S' },
    { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs-ace', stopId: 'A11S' },
  ];

  const COLORS = {
    '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
    'B': '#FF6319', 'C': '#0039A6',
  };

  const now = Math.floor(Date.now() / 1000);
  const arrivals = [];
  const errors = [];

  await Promise.all(FEEDS.map(async (feed) => {
    try {
      const res = await fetch(feed.url);
      if (!res.ok) {
        errors.push(`${feed.url} returned HTTP ${res.status}`);
        return;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      errors.push(`${feed.stopId}: fetched ${buf.length} bytes OK`);

      const feedMsg = parseProto(buf);
      const entityCount = (feedMsg[2] || []).length;
      errors.push(`${feed.stopId}: parsed ${entityCount} entities`);

      for (const entityBytes of (feedMsg[2] || [])) {
        const entity = parseProto(entityBytes);
        if (!entity[3] || !entity[3][0]) continue;
        const tu = parseProto(entity[3][0]);
        if (!tu[1] || !tu[1][0]) continue;
        const trip = parseProto(tu[1][0]);
        if (!trip[5] || !trip[5][0]) continue;
        const routeId = str(trip[5][0]);
        for (const stuBytes of (tu[2] || [])) {
          const stu = parseProto(stuBytes);
          if (!stu[2] || !stu[2][0]) continue;
          if (str(stu[2][0]) !== feed.stopId) continue;
          const eventBytes = (stu[3] && stu[3][0]) || (stu[4] && stu[4][0]);
          if (!eventBytes) continue;
          const event = parseProto(eventBytes);
          const t = event[2];
          if (!t || t < now) continue;
          arrivals.push({
            line: routeId,
            minutes: Math.round((t - now) / 60),
            color: COLORS[routeId] || '#888',
            timestamp: t * 1000,
          });
        }
      }
    } catch (e) {
      errors.push(`${feed.stopId} error: ${e.message}`);
    }
  }));

  arrivals.sort((a, b) => a.timestamp - b.timestamp);

  return new Response(
    JSON.stringify({ arrivals: arrivals.slice(0, 10), updated: Date.now(), debug: errors }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } }
  );
}

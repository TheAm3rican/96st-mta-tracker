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
    if (tag === 0) break;
    const fieldNum = tag >>> 3;
    const wireType = tag & 7;
    if (wireType === 0) {
      let val;
      [val, pos] = parseVarint(buf, pos);
      if (!fields[fieldNum]) fields[fieldNum] = [];
      fields[fieldNum].push(val);
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

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(' ');
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const dec = new TextDecoder();

    if (url.pathname === '/debug') {
      const res = await fetch('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs');
      const buf = new Uint8Array(await res.arrayBuffer());
      const feedMsg = parseProto(buf);
      const result = [];

      for (const entityBytes of (feedMsg[2] || []).slice(0, 5)) {
        const entity = parseProto(entityBytes);
        if (!entity[3] || !entity[3][0]) continue;
        const tu = parseProto(entity[3][0]);
        if (!tu[2] || !tu[2][0]) continue;

        // Show ALL fields in the first StopTimeUpdate
        const stuBytes = tu[2][0];
        const stu = parseProto(stuBytes);
        const stuFields = {};
        for (const [k, v] of Object.entries(stu)) {
          stuFields[k] = v.map(b => {
            if (b instanceof Uint8Array) {
              return { hex: toHex(b), text: dec.decode(b) };
            }
            return b;
          });
        }

        result.push({
          stuRawHex: toHex(stuBytes.slice(0, 30)),
          stuFields
        });
        break;
      }

      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('ok');
  }
};

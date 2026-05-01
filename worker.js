const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <title>96th St · Southbound</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --bg: #0d0d0d; --surface: #161616; --border: #252525; --text: #f0f0f0; --muted: #666; --arriving: #4ade80; }
    html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
    body { display: flex; flex-direction: column; min-height: 100dvh; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
    header { padding: 28px 20px 0; }
    .station-label { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
    .station-name { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
    .direction-badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 4px 10px 4px 8px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: var(--muted); }
    .direction-badge::before { content: '↓'; font-size: 13px; color: var(--text); }
    .refresh-bar { display: flex; align-items: center; justify-content: space-between; padding: 20px 20px 12px; margin-top: 24px; border-top: 1px solid var(--border); }
    .refresh-bar span { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); letter-spacing: 0.05em; }
    .pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--arriving); animation: pulse 2s ease-in-out infinite; }
    .pulse-dot.inactive { background: var(--muted); animation: none; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    #train-list { flex: 1; padding: 0 16px 24px; display: flex; flex-direction: column; gap: 10px; }
    .train-row { display: flex; align-items: center; gap: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; animation: slideIn 0.3s ease; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .line-circle { flex-shrink: 0; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; color: #fff; font-family: 'DM Sans', sans-serif; }
    .train-info { flex: 1; }
    .train-dest { font-size: 13px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 0.02em; margin-bottom: 2px; }
    .train-subtext { font-size: 12px; color: #3a3a3a; font-family: 'DM Mono', monospace; }
    .train-time { text-align: right; }
    .minutes { font-family: 'DM Mono', monospace; font-size: 28px; font-weight: 500; line-height: 1; letter-spacing: -0.03em; }
    .minutes.arriving { color: var(--arriving); }
    .min-label { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }
    .state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--muted); font-family: 'DM Mono', monospace; font-size: 13px; letter-spacing: 0.05em; padding: 40px 20px; }
    .state-icon { font-size: 32px; opacity: 0.4; }
    .spinner { width: 28px; height: 28px; border: 2px solid var(--border); border-top-color: var(--muted); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-text { color: #ef4444; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <header>
    <div class="station-label">NYC Subway · 96th Street</div>
    <div class="station-name">Upper West Side</div>
    <div class="direction-badge">Southbound</div>
  </header>
  <div class="refresh-bar">
    <span id="updated-label">Fetching trains...</span>
    <div class="pulse-dot inactive" id="dot"></div>
  </div>
  <div id="train-list">
    <div class="state"><div class="spinner"></div><span>Loading arrivals</span></div>
  </div>
  <script>
    const DESTINATIONS = { '1':'South Ferry','2':'Flatbush Av','3':'New Lots Av','A':'Far Rockaway','C':'Euclid Av','E':'Jamaica' };
    const STATION = { '1':'96 St / Broadway','2':'96 St / Broadway','3':'96 St / Broadway','A':'96 St / CPW','C':'96 St / CPW','E':'96 St / CPW' };
    let lastUpdated = null;
    function formatUpdated(ts) {
      const secs = Math.round((Date.now() - ts) / 1000);
      if (secs < 5) return 'Just updated';
      if (secs < 60) return 'Updated ' + secs + 's ago';
      return 'Updated ' + Math.round(secs / 60) + 'm ago';
    }
    function render(arrivals) {
      const list = document.getElementById('train-list');
      if (!arrivals || arrivals.length === 0) {
        list.innerHTML = '<div class="state"><div class="state-icon">🚇</div><span>No trains in the next 30 min</span></div>';
        return;
      }
      list.innerHTML = arrivals.map(function(a) {
        const arriving = a.minutes <= 1;
        return '<div class="train-row">' +
          '<div class="line-circle" style="background:' + a.color + '">' + a.line + '</div>' +
          '<div class="train-info"><div class="train-dest">' + (DESTINATIONS[a.line] || 'Downtown') + '</div>' +
          '<div class="train-subtext">' + (STATION[a.line] || '') + '</div></div>' +
          '<div class="train-time"><div class="minutes' + (arriving ? ' arriving' : '') + '">' + (arriving ? 'Now' : a.minutes) + '</div>' +
          '<div class="min-label">' + (arriving ? '' : 'min') + '</div></div></div>';
      }).join('');
    }
    async function fetchTrains() {
      const dot = document.getElementById('dot');
      const label = document.getElementById('updated-label');
      dot.className = 'pulse-dot';
      try {
        const res = await fetch('/trains');
        if (!res.ok) throw new Error('error');
        const data = await res.json();
        lastUpdated = data.updated;
        label.textContent = formatUpdated(lastUpdated);
        render(data.arrivals);
      } catch(e) {
        label.textContent = 'Error loading trains';
        dot.className = 'pulse-dot inactive';
        const list = document.getElementById('train-list');
        if (!list.querySelector('.train-row')) {
          list.innerHTML = '<div class="state"><div class="state-icon">⚠️</div><span class="error-text">Could not reach MTA.<br>Check connection or try again.</span></div>';
        }
      }
    }
    fetchTrains();
    setInterval(fetchTrains, 30000);
    setInterval(function() { if (lastUpdated) document.getElementById('updated-label').textContent = formatUpdated(lastUpdated); }, 5000);
    document.addEventListener('visibilitychange', function() { if (!document.hidden) fetchTrains(); });
  </script>
</body>
</html>`;

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

function getTime(eventBytes) {
  if (!eventBytes) return null;
  const event = parseProto(eventBytes);
  // field 2 is time, stored as array of values now
  if (event[2] && event[2][0] !== undefined) return event[2][0];
  return null;
}

async function getTrains() {
  const FEEDS = [
    { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs', stopId: '121S' },
    { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace', stopId: 'A11S' },
  ];
  const COLORS = {
    '1':'#EE352E','2':'#EE352E','3':'#EE352E',
    'A':'#0039A6','C':'#0039A6','E':'#0039A6',
  };
  const dec = new TextDecoder();
  const now = Math.floor(Date.now() / 1000);
  const arrivals = [];

  await Promise.all(FEEDS.map(async function(feed) {
    try {
      const res = await fetch(feed.url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = new Uint8Array(await res.arrayBuffer());
      const feedMsg = parseProto(buf);

      for (const entityBytes of (feedMsg[2] || [])) {
        const entity = parseProto(entityBytes);
        if (!entity[3] || !entity[3][0]) continue;
        const tu = parseProto(entity[3][0]);
        if (!tu[1] || !tu[1][0]) continue;
        const trip = parseProto(tu[1][0]);
        if (!trip[5] || !trip[5][0]) continue;
        const routeId = dec.decode(trip[5][0]);

        for (const stuBytes of (tu[2] || [])) {
          const stu = parseProto(stuBytes);
          // stop_id is field 4 in NYCT feed
          if (!stu[4] || !stu[4][0]) continue;
          if (dec.decode(stu[4][0]) !== feed.stopId) continue;

          // arrival is field 2, departure is field 3
          const t = getTime(stu[2] && stu[2][0]) || getTime(stu[3] && stu[3][0]);
          if (!t || t < now) continue;

          arrivals.push({
            line: routeId,
            minutes: Math.round((t - now) / 60),
            color: COLORS[routeId] || '#888',
            timestamp: t * 1000,
          });
        }
      }
    } catch(e) {
      console.error('Feed error:', e.message);
    }
  }));

  arrivals.sort(function(a, b) { return a.timestamp - b.timestamp; });
  return arrivals.slice(0, 10);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/trains') {
      const arrivals = await getTrains();
      return new Response(JSON.stringify({ arrivals, updated: Date.now() }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
      });
    }

    return new Response(HTML, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};

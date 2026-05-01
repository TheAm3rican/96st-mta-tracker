import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const FEEDS = [
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs', stopId: '121S' },
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs-bdfm', stopId: 'A11S' },
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/gtfs-ace', stopId: 'A11S' },
];

const LINE_COLORS = {
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  'B': '#FF6319', 'C': '#0039A6',
};

export async function onRequest() {
  const now = Math.floor(Date.now() / 1000);
  const arrivals = [];

  await Promise.all(FEEDS.map(async (feed) => {
    try {
      const res = await fetch(feed.url);
      const buffer = await res.arrayBuffer();
      const message = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(buffer)
      );
      for (const entity of message.entity) {
        if (!entity.tripUpdate) continue;
        const { trip, stopTimeUpdate } = entity.tripUpdate;
        for (const stu of stopTimeUpdate) {
          if (stu.stopId !== feed.stopId) continue;
          const rawTime = stu.arrival?.time ?? stu.departure?.time;
          if (!rawTime) continue;
          const arrSeconds = typeof rawTime === 'object' && rawTime.toNumber
            ? rawTime.toNumber()
            : Number(rawTime);
          if (arrSeconds < now) continue;
          arrivals.push({
            line: trip.routeId,
            minutes: Math.round((arrSeconds - now) / 60),
            color: LINE_COLORS[trip.routeId] || '#888',
            timestamp: arrSeconds * 1000,
          });
        }
      }
    } catch (e) {
      console.error(e.message);
    }
  }));

  arrivals.sort((a, b) => a.timestamp - b.timestamp);

  return new Response(JSON.stringify({ arrivals: arrivals.slice(0, 10), updated: Date.now() }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}

import { NextRequest, NextResponse } from "next/server";

type RawAircraft = Record<string, string | number | boolean | null | undefined>;

function toRad(value: number) { return value * Math.PI / 180; }
function geo(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const y = Math.sin(dLon) * Math.cos(toRad(bLat));
  const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(dLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return { distance: 3440.065 * 2 * Math.asin(Math.sqrt(h)), bearing: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360 };
}

function demo(lat: number, lon: number) {
  const samples = [
    ["4ca8e4", "RYR37TZ", .18, -.21, 31800, 438, 132, -384, "B738", "EI-EVR"],
    ["3c65a2", "DLH7AW", -.12, .33, 24400, 412, 287, 896, "A321", "D-AIDB"],
    ["44082a", "EJU84KL", .39, .08, 11850, 326, 194, -640, "A320", "OE-IVI"],
    ["4b1805", "SWR173", -.28, -.45, 37600, 461, 74, 64, "A220", "HB-JCA"],
    ["3004b2", "ITA614", .08, .12, 7200, 248, 221, 1216, "A319", "EI-IML"],
    ["4ca9c1", "RYR6NT", -.51, .15, 35200, 447, 18, 0, "B38M", "EI-HAT"],
  ];
  return samples.map((s, index) => {
    const pLat = lat + Number(s[2]), pLon = lon + Number(s[3]);
    return { hex:s[0], flight:s[1], lat:pLat, lon:pLon, altitude:s[4], speed:s[5], heading:s[6], verticalRate:s[7], type:s[8], registration:s[9], ...geo(lat, lon, pLat, pLon), seen:index + 1 };
  });
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const radius = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("radius")) || 50));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  try {
    const response = await fetch(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radius}`, { headers: { "User-Agent": "AeroRadar prototype" }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error("source error");
    const payload = await response.json() as { ac?: RawAircraft[] };
    const aircraft = (payload.ac ?? []).flatMap((item) => {
      const pLat = Number(item.lat), pLon = Number(item.lon);
      if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return [];
      const altitude = Number(item.alt_baro === "ground" ? 0 : item.alt_baro ?? item.alt_geom ?? 0);
      const speed = Number(item.gs ?? 0);
      const onGround = item.alt_baro === "ground" || (speed < 30 && altitude < 1500);
      return [{ hex:String(item.hex ?? "unknown"), flight:String(item.flight ?? item.r ?? item.hex ?? "未知").trim(), lat:pLat, lon:pLon, altitude, speed, heading:Number(item.track ?? item.true_heading ?? 0), verticalRate:Number(item.baro_rate ?? item.geom_rate ?? 0), type:String(item.t ?? ""), registration:String(item.r ?? ""), onGround, ...geo(lat, lon, pLat, pLon), seen:Number(item.seen ?? 0) }];
    }).sort((a, b) => a.distance - b.distance);
    if (!aircraft.length) return NextResponse.json({ aircraft: demo(lat, lon), mode:"demo" });
    return NextResponse.json({ aircraft, mode:"live" }, { headers: { "Cache-Control":"public, max-age=5, stale-while-revalidate=30" } });
  } catch {
    return NextResponse.json({ aircraft: demo(lat, lon), mode:"demo" });
  }
}

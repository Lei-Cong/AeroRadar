import { NextRequest, NextResponse } from "next/server";

type Airport = { iata_code?: string; icao_code?: string };
type RouteResponse = { response?: { flightroute?: { origin?: Airport; destination?: Airport } } };

export async function GET(request: NextRequest) {
  const callsigns = [...new Set((request.nextUrl.searchParams.get("callsigns") ?? "").split(",").map((item) => item.trim().toUpperCase()).filter((item) => /^[A-Z0-9]{3,10}$/.test(item)))].slice(0, 30);
  if (!callsigns.length) return NextResponse.json({ routes: {} });
  const pairs = await Promise.all(callsigns.map(async (callsign) => {
    try {
      const response = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`, { headers: { "User-Agent": "AeroRadar/1.0" }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      const data = await response.json() as RouteResponse;
      const route = data.response?.flightroute;
      const origin = route?.origin?.iata_code || route?.origin?.icao_code;
      const destination = route?.destination?.iata_code || route?.destination?.icao_code;
      return origin && destination ? [callsign, { origin, destination }] as const : null;
    } catch { return null; }
  }));
  return NextResponse.json({ routes: Object.fromEntries(pairs.filter((pair): pair is NonNullable<typeof pair> => pair !== null)) }, { headers: { "Cache-Control": "public, max-age=3600" } });
}

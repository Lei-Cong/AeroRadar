import { NextRequest, NextResponse } from "next/server";

type OverpassWay = {
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

function distanceMeters(start: { lat: number; lon: number }, end: { lat: number; lon: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(end.lat - start.lat);
  const dLon = toRad(end.lon - start.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const radiusKm = Math.min(60, Math.max(5, Number(request.nextUrl.searchParams.get("radiusKm")) || 25));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const query = `[out:json][timeout:12];way["aeroway"="runway"](around:${Math.round(radiusKm * 1000)},${lat},${lon});out tags geom;`;
  try {
    const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.openstreetmap.fr/api/interpreter"];
    let payload: { elements?: OverpassWay[] } | null = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "AeroRadar prototype" },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(9000),
        });
        if (response.ok) { payload = await response.json() as { elements?: OverpassWay[] }; break; }
      } catch { /* try next public mirror */ }
    }
    if (!payload) throw new Error("runway source unavailable");
    const runways = (payload.elements ?? []).flatMap((way) => {
      const geometry = way.geometry ?? [];
      if (geometry.length < 2) return [];
      const start = geometry[0];
      const end = geometry[geometry.length - 1];
      return [{ id: String(way.id), ref: way.tags?.ref ?? "", surface: way.tags?.surface ?? "", lengthMeters: Math.round(distanceMeters(start, end)), start, end }];
    }).slice(0, 40);
    return NextResponse.json({ runways, status: "live" }, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ runways: [], status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

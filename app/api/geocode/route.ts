import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 3 || query.length > 180) return NextResponse.json({ error: "请输入有效地址" }, { status: 400 });
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");
    const response = await fetch(url, { headers: { "User-Agent": "AeroRadar/1.0 (private flight radar prototype)", "Accept-Language": "zh-CN,de;q=0.8,en;q=0.6" }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error("geocoder unavailable");
    const results = await response.json() as { lat: string; lon: string; display_name: string }[];
    const match = results[0];
    if (!match) return NextResponse.json({ error: "未找到地址" }, { status: 404 });
    return NextResponse.json({ lat: Number(match.lat), lon: Number(match.lon), label: match.display_name }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "地址服务暂时不可用" }, { status: 503 });
  }
}

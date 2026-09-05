"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Aircraft = {
  hex: string;
  flight: string;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number;
  verticalRate: number;
  type?: string;
  registration?: string;
  distance: number;
  bearing: number;
  seen: number;
  onGround?: boolean;
  trail?: { lat: number; lon: number }[];
};

type Position = { lat: number; lon: number; label: string };
type RouteInfo = { origin: string; destination: string };
type Runway = { id: string; ref: string; surface: string; lengthMeters: number; start: { lat: number; lon: number }; end: { lat: number; lon: number } };
type Locale = "zh" | "de" | "en";

const COPY = {
  zh: { headline:"抬头，看看谁正飞过。", privacy:"公开 ADS-B 数据 · 地址不会被保存", address:"观测地址", placeholder:"输入街道、邮编和城市", locate:"定位雷达", useLocation:"使用我的位置", nearby:"附近飞机", low:"低于 10,000 ft", nearest:"最近 / 海里", forecast:"今日全天统计", busiest:"最繁忙", estimate:"模型估算", radius:"统计半径", radiusHint:"仅影响全天统计；雷达显示范围可独立选择", direction:"当前运行方向", hourly:"每小时预计进入范围的飞机数量（架）", fullDay:"完整 24 小时", range:"显示范围", runwayLayer:"跑道图层", major:"主要跑道", all:"全部跑道", showing:"当前显示", unitRunway:"条", runwayLoading:"正在读取跑道…", runwayError:"跑道数据暂不可用，保留上次结果", refresh:"立即刷新", scanning:"正在扫描…", legend:"图例", airliner:"客机 / 宽体", light:"小型飞机", helicopter:"直升机", runway:"机场跑道", trail:"最近航迹", home:"观测点", selected:"所选飞机", altitude:"高度", speed:"地速", heading:"航向", distance:"距离", lastScan:"最后扫描", disclaimer:"非航空导航用途 · 请勿用于安全关键决策" },
  de: { headline:"Schau nach oben – wer fliegt gerade vorbei?", privacy:"Öffentliche ADS-B-Daten · Adresse wird nicht gespeichert", address:"Beobachtungsadresse", placeholder:"Straße, PLZ und Ort eingeben", locate:"Radar ausrichten", useLocation:"Meinen Standort verwenden", nearby:"Flugzeuge in der Nähe", low:"Unter 10.000 ft", nearest:"Nächste / NM", forecast:"Tagesstatistik heute", busiest:"am stärksten", estimate:"Modellschätzung", radius:"Statistikradius", radiusHint:"Nur für die Tagesstatistik; Radarbereich separat wählbar", direction:"Aktuelle Betriebsrichtung", hourly:"Geschätzte Flugzeuge pro Stunde im Bereich", fullDay:"Volle 24 Stunden", range:"Radarbereich", runwayLayer:"Startbahnen", major:"Hauptbahnen", all:"Alle Bahnen", showing:"Angezeigt", unitRunway:"Bahnen", runwayLoading:"Startbahnen werden geladen…", runwayError:"Startbahndaten derzeit nicht verfügbar; letzter Stand bleibt sichtbar", refresh:"Aktualisieren", scanning:"Scan läuft…", legend:"Legende", airliner:"Verkehrsflugzeug / Großraum", light:"Kleinflugzeug", helicopter:"Hubschrauber", runway:"Startbahn", trail:"Letzte Flugspur", home:"Beobachtungspunkt", selected:"AUSGEWÄHLTES FLUGZEUG", altitude:"Höhe", speed:"Geschwindigkeit", heading:"Kurs", distance:"Entfernung", lastScan:"Letzter Scan", disclaimer:"Nicht zur Flugnavigation oder für sicherheitskritische Entscheidungen" },
  en: { headline:"Look up. See who is flying by.", privacy:"Public ADS-B data · Address is not stored", address:"Observation address", placeholder:"Enter street, postcode and city", locate:"Set radar", useLocation:"Use my location", nearby:"Nearby aircraft", low:"Below 10,000 ft", nearest:"Nearest / NM", forecast:"Today's full-day statistics", busiest:"busiest", estimate:"model estimate", radius:"Statistics radius", radiusHint:"Only affects daily statistics; radar range is selected separately", direction:"Current runway operation", hourly:"Estimated aircraft entering the area per hour", fullDay:"Full 24 hours", range:"Display range", runwayLayer:"Runway layer", major:"Main runways", all:"All runways", showing:"Showing", unitRunway:"runways", runwayLoading:"Loading runways…", runwayError:"Runway data unavailable; keeping the last result", refresh:"Refresh now", scanning:"Scanning…", legend:"Legend", airliner:"Airliner / widebody", light:"Light aircraft", helicopter:"Helicopter", runway:"Airport runway", trail:"Recent track", home:"Observation point", selected:"SELECTED AIRCRAFT", altitude:"Altitude", speed:"Ground speed", heading:"Heading", distance:"Distance", lastScan:"Last scan", disclaimer:"Not for navigation or safety-critical decisions" },
} as const;

const RECEIVER_COPY = {
  zh: { eyebrow:"本地实时接收 · 可选升级", title:"树莓派 + RTL-SDR：把家庭雷达变成自己的接收站", body:"飞机会直接广播 1090 MHz ADS-B 信号。天线与 RTL-SDR 接收后，由树莓派上的 readsb 或 dump1090 解码，再传给本网页；无需等待公共飞机位置接口。", note:"位置、高度、速度和航向可近实时更新；出发地、目的地及航班计划仍需联网数据库补充。接收范围取决于天线高度、建筑遮挡和地形。", direct:"直接无线接收", local:"家中处理", fallback:"公共数据备用" },
  de: { eyebrow:"LOKALER LIVE-EMPFANG · OPTIONALES UPGRADE", title:"Raspberry Pi + RTL-SDR: die eigene ADS-B-Empfangsstation", body:"Flugzeuge senden ADS-B direkt auf 1090 MHz. Antenne und RTL-SDR empfangen das Signal; readsb oder dump1090 auf dem Raspberry Pi dekodiert es und liefert die Daten an diese Webseite – ohne Umweg über eine öffentliche Positions-API.", note:"Position, Höhe, Geschwindigkeit und Kurs werden nahezu live aktualisiert. Start, Ziel und Flugplan benötigen weiterhin eine Online-Datenbank. Die Reichweite hängt von Antennenhöhe, Gebäuden und Gelände ab.", direct:"Direkter Funkempfang", local:"Lokale Verarbeitung", fallback:"Öffentliche Daten als Reserve" },
  en: { eyebrow:"LOCAL LIVE RECEPTION · OPTIONAL UPGRADE", title:"Raspberry Pi + RTL-SDR: turn the home radar into your own receiver", body:"Aircraft broadcast 1090 MHz ADS-B signals directly. An antenna and RTL-SDR receive them; readsb or dump1090 on the Raspberry Pi decodes the messages and feeds this webpage without waiting for a public aircraft-position API.", note:"Position, altitude, speed and heading can update near real time. Origin, destination and flight plans still require an online database. Reception range depends on antenna height, buildings and terrain.", direct:"Direct radio reception", local:"Processed at home", fallback:"Public-data fallback" },
} as const;

const DETAIL_COPY = {
  zh: { finding:"正在查找…", centered:"已设为观测中心", notFound:"未找到，请补充城市或邮编", myLocation:"我的当前位置", closest:"距您最近点", bearing:"方位", received:"秒前收到数据", searching:"正在寻找附近飞机…", source:"数据来源", live:"实时数据", stale:"连接波动 · 保留上次数据", demo:"演示数据", sourceLive:"全球志愿者 ADS-B 接收站数据，位置与航班信息可能延迟或缺失。", sourceStale:"实时源本轮未响应，雷达保留上一批真实数据，恢复后会自动继续。", sourceDemo:"实时源未返回数据，当前飞机为可交互的模拟样本。", east:"东向运行 · Mainz 进场活跃", west:"西向运行 · 上空通常较少", waiting:"等待更多航迹", inferred:"实时航迹推断", low:"低可信度" },
  de: { finding:"Adresse wird gesucht…", centered:"Als Beobachtungspunkt gesetzt", notFound:"Nicht gefunden – bitte Ort oder PLZ ergänzen", myLocation:"Mein Standort", closest:"Nächster Punkt", bearing:"Peilung", received:"Sek. seit Empfang", searching:"Flugzeuge in der Nähe werden gesucht…", source:"DATENQUELLE", live:"Live-Daten", stale:"Verbindung schwankt · letzter Stand", demo:"Demo-Daten", sourceLive:"Daten freiwilliger ADS-B-Empfänger; Positionen und Fluginfos können verzögert oder unvollständig sein.", sourceStale:"Die Live-Quelle antwortet gerade nicht. Der letzte echte Stand bleibt bis zur Wiederherstellung sichtbar.", sourceDemo:"Keine Live-Daten verfügbar. Die angezeigten Flugzeuge sind interaktive Beispieldaten.", east:"Ostbetrieb · Anflug Mainz aktiv", west:"Westbetrieb · meist weniger Überflüge", waiting:"Weitere Flugspuren erforderlich", inferred:"Aus Live-Flugspuren abgeleitet", low:"Geringe Sicherheit" },
  en: { finding:"Finding address…", centered:"Observation centre updated", notFound:"Not found; add a city or postcode", myLocation:"My current location", closest:"Closest point", bearing:"Bearing", received:"sec since received", searching:"Looking for nearby aircraft…", source:"DATA SOURCE", live:"Live data", stale:"Connection unstable · last data kept", demo:"Demo data", sourceLive:"Data from volunteer ADS-B receivers; positions and flight details may be delayed or incomplete.", sourceStale:"The live source did not respond. The last real data remains visible until service resumes.", sourceDemo:"No live data was returned. The displayed aircraft are interactive samples.", east:"Eastbound operation · Mainz arrivals active", west:"Westbound operation · usually fewer overflights", waiting:"Waiting for more tracks", inferred:"Inferred from live tracks", low:"Low confidence" },
} as const;

const DEMO_CENTER: Position = { lat: 49.984, lon: 8.244, label: "Hinter der Kapelle 附近 · Mainz-Bretzenheim" };
const RANGES = [2, 5, 10, 20, 50, 100];
const DAY_PROFILE = [
  { hour: 0, value: 6 }, { hour: 1, value: 3 }, { hour: 2, value: 2 }, { hour: 3, value: 2 }, { hour: 4, value: 7 },
  { hour: 5, value: 34 }, { hour: 6, value: 55 }, { hour: 7, value: 78 }, { hour: 8, value: 84 },
  { hour: 9, value: 68 }, { hour: 10, value: 58 }, { hour: 11, value: 62 }, { hour: 12, value: 74 },
  { hour: 13, value: 55 }, { hour: 14, value: 52 }, { hour: 15, value: 65 }, { hour: 16, value: 78 },
  { hour: 17, value: 94 }, { hour: 18, value: 100 }, { hour: 19, value: 83 }, { hour: 20, value: 72 },
  { hour: 21, value: 61 }, { hour: 22, value: 51 }, { hour: 23, value: 16 },
];

function polarPoint(distance: number, bearing: number, radiusNm: number) {
  const radius = Math.min(distance / radiusNm, 1) * 46;
  const angle = ((bearing - 90) * Math.PI) / 180;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

function geoFromCenter(center: Position, point: { lat: number; lon: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(point.lat - center.lat);
  const dLon = toRad(point.lon - center.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(center.lat)) * Math.cos(toRad(point.lat)) * Math.sin(dLon / 2) ** 2;
  const distance = 3440.065 * 2 * Math.asin(Math.sqrt(a));
  const y = Math.sin(dLon) * Math.cos(toRad(point.lat));
  const x = Math.cos(toRad(center.lat)) * Math.sin(toRad(point.lat)) - Math.sin(toRad(center.lat)) * Math.cos(toRad(point.lat)) * Math.cos(dLon);
  return { distance, bearing: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360 };
}

function starterAircraft(): Aircraft[] {
  const samples = [
    { hex:"preview1", flight:"BEL9DN", lat:DEMO_CENTER.lat + .08, lon:DEMO_CENTER.lon + .12, altitude:11800, speed:285, heading:224, verticalRate:-640, type:"A320", registration:"" },
    { hex:"preview2", flight:"DLH4XR", lat:DEMO_CENTER.lat - .09, lon:DEMO_CENTER.lon + .2, altitude:19600, speed:365, heading:287, verticalRate:-320, type:"A321", registration:"" },
    { hex:"preview3", flight:"D-EABC", lat:DEMO_CENTER.lat + .04, lon:DEMO_CENTER.lon - .06, altitude:4200, speed:112, heading:36, verticalRate:120, type:"C172", registration:"D-EABC" },
  ];
  return samples.map((plane, index) => ({ ...plane, ...geoFromCenter(DEMO_CENTER, plane), seen:index + 1, onGround:false, trail:[{ lat:plane.lat, lon:plane.lon }] }));
}

function bearingBetween(start: { lat: number; lon: number }, end: { lat: number; lon: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLon = toRad(end.lon - start.lon);
  const y = Math.sin(dLon) * Math.cos(toRad(end.lat));
  const x = Math.cos(toRad(start.lat)) * Math.sin(toRad(end.lat)) - Math.sin(toRad(start.lat)) * Math.cos(toRad(end.lat)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function visualHeading(plane: Aircraft) {
  const trail = plane.trail ?? [];
  if (trail.length < 2) return plane.heading;
  const current = trail[trail.length - 1];
  for (let index = trail.length - 2; index >= 0; index--) {
    const previous = trail[index];
    const movement = Math.abs(current.lat - previous.lat) + Math.abs(current.lon - previous.lon);
    if (movement > .00002) return bearingBetween(previous, current);
  }
  return plane.heading;
}

function fmtAltitude(ft: number) {
  return ft > 0 ? `${Math.round(ft).toLocaleString("zh-CN")} ft` : "地面";
}

function aircraftIcon(type = "") {
  const code = type.toUpperCase();
  if (/^(H|EC|AS|R22|R44|R66|S76|B06)/.test(code)) return { glyph: "🚁", kind: "helicopter", label: "直升机" };
  if (/^(C[12]|PA|DA|SR|PC|BE|TBM|AT|DH[268]|E[123]|GL|LJ)/.test(code)) return { glyph: "✈︎", kind: "light", label: "小型飞机" };
  if (/^(A3[3458]|B7[478]|B77|B78)/.test(code)) return { glyph: "✈️", kind: "heavy", label: "大型客机" };
  return { glyph: "✈️", kind: "jet", label: "客机" };
}

export default function Home() {
  const [position, setPosition] = useState<Position>(DEMO_CENTER);
  const [aircraft, setAircraft] = useState<Aircraft[]>(starterAircraft);
  const [selectedHex, setSelectedHex] = useState<string>("preview1");
  const [range, setRange] = useState(50);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"live" | "demo" | "stale">("demo");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [address, setAddress] = useState("Hinter der Kapelle, 55128 Mainz");
  const [addressStatus, setAddressStatus] = useState("");
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [statsRadiusKm, setStatsRadiusKm] = useState(5);
  const [routes, setRoutes] = useState<Record<string, RouteInfo>>({});
  const [runways, setRunways] = useState<Runway[]>([]);
  const [runwayMode, setRunwayMode] = useState<"major" | "all">("major");
  const [runwayStatus, setRunwayStatus] = useState<"loading" | "ready" | "error">("loading");
  const [locale, setLocale] = useState<Locale>("zh");
  const trails = useRef<Record<string, { lat: number; lon: number }[]>>({});
  const aircraftCache = useRef<Record<string, { plane: Aircraft; updated: number }>>({});
  const hasLiveData = useRef(false);
  const requestedRoutes = useRef(new Set<string>());

  const loadRoutes = useCallback(async (planes: Aircraft[]) => {
    const callsigns = planes.slice(0, 30).map((plane) => plane.flight.trim().toUpperCase()).filter((flight) => flight && flight !== "未知" && !requestedRoutes.current.has(flight));
    if (!callsigns.length) return;
    callsigns.forEach((flight) => requestedRoutes.current.add(flight));
    try {
      const response = await fetch(`/api/routes?callsigns=${encodeURIComponent(callsigns.join(","))}`);
      if (!response.ok) throw new Error("route lookup failed");
      const data = await response.json() as { routes: Record<string, RouteInfo> };
      setRoutes((current) => ({ ...current, ...data.routes }));
    } catch {
      callsigns.forEach((flight) => requestedRoutes.current.delete(flight));
    }
  }, []);

  const loadAircraft = useCallback(async (pos: Position, chosenRange = range) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/aircraft?lat=${pos.lat}&lon=${pos.lon}&radius=${chosenRange}`, { cache: "no-store" });
      if (!response.ok) throw new Error("live source unavailable");
      const data = await response.json() as { aircraft: Aircraft[]; mode: "live" | "demo" };
      if (data.mode === "demo" && hasLiveData.current) {
        setMode("stale");
        setUpdatedAt(new Date());
        return;
      }
      const now = Date.now();
      data.aircraft.filter((plane) => plane.onGround).forEach((plane) => {
        delete aircraftCache.current[plane.hex];
        delete trails.current[plane.hex];
      });
      const withTrails = data.aircraft.filter((plane) => !plane.onGround).map((plane) => {
        const history = [...(trails.current[plane.hex] ?? []), { lat: plane.lat, lon: plane.lon }].slice(-8);
        trails.current[plane.hex] = history;
        const tracked = { ...plane, trail: history };
        aircraftCache.current[plane.hex] = { plane: tracked, updated: now };
        return tracked;
      });
      const stabilized = data.mode === "live"
        ? Object.values(aircraftCache.current).filter((entry) => now - entry.updated < 60000).map((entry) => entry.plane).sort((a, b) => a.distance - b.distance)
        : withTrails;
      hasLiveData.current = data.mode === "live";
      setAircraft(stabilized);
      if (data.mode === "live") window.localStorage.setItem("aeroradar-last-live", JSON.stringify({ savedAt:now, position:pos, aircraft:stabilized.slice(0, 80) }));
      void loadRoutes(stabilized);
      setMode(data.mode);
      setSelectedHex((current) => current || stabilized[0]?.hex || "");
      setUpdatedAt(new Date());
    } catch {
      setMode("demo");
    } finally {
      setLoading(false);
    }
  }, [range, loadRoutes]);

  useEffect(() => {
    try {
      const cached = JSON.parse(window.localStorage.getItem("aeroradar-last-live") ?? "null") as { savedAt?: number; position?: Position; aircraft?: Aircraft[] } | null;
      if (cached?.savedAt && Date.now() - cached.savedAt < 15 * 60 * 1000 && cached.position && cached.aircraft?.length) {
        setPosition(cached.position); setAircraft(cached.aircraft); setSelectedHex(cached.aircraft[0].hex); setMode("stale"); hasLiveData.current = true;
        cached.aircraft.forEach((plane) => { aircraftCache.current[plane.hex] = { plane, updated:Date.now() }; trails.current[plane.hex] = plane.trail ?? []; });
      }
    } catch { /* ignore damaged device-local cache */ }
    if (navigator.permissions?.query) navigator.permissions.query({ name:"geolocation" }).then((permission) => {
      if (permission.state === "granted") navigator.geolocation.getCurrentPosition(({ coords }) => setPosition({ lat:coords.latitude, lon:coords.longitude, label:"Current location" }), () => undefined, { maximumAge:300000, timeout:5000 });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadAircraft(position);
    const timer = window.setInterval(() => loadAircraft(position), 15000);
    return () => window.clearInterval(timer);
  }, [position, loadAircraft]);

  useEffect(() => {
    const controller = new AbortController();
    setRunwayStatus("loading");
    const radiusKm = Math.min(60, Math.max(5, range * 1.852 + 5));
    fetch(`/api/runways?v=2&lat=${position.lat}&lon=${position.lon}&radiusKm=${radiusKm}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { runways?: Runway[] }) => { setRunways(data.runways ?? []); setRunwayStatus("ready"); })
      .catch(() => { if (!controller.signal.aborted) setRunwayStatus("error"); });
    return () => controller.abort();
  }, [position, range]);

  useEffect(() => {
    const syncLocalTime = () => setCurrentHour(new Date().getHours());
    syncLocalTime();
    const timer = window.setInterval(syncLocalTime, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedRadius = Number(window.localStorage.getItem("aeroradar-stats-radius-km"));
    if (Number.isFinite(savedRadius) && savedRadius >= 1 && savedRadius <= 50) setStatsRadiusKm(savedRadius);
    const savedLocale = window.localStorage.getItem("aeroradar-locale") as Locale | null;
    if (savedLocale && savedLocale in COPY) setLocale(savedLocale);
  }, []);

  const selected = aircraft.find((plane) => plane.hex === selectedHex) ?? aircraft[0];
  const visible = useMemo(() => aircraft.filter((plane) => !plane.onGround && plane.distance <= range), [aircraft, range]);
  const localTraffic = useMemo(() => aircraft.filter((plane) => plane.distance <= 15 && plane.altitude <= 16000), [aircraft]);
  const operation = useMemo(() => {
    const copy = DETAIL_COPY[locale];
    const eastbound = localTraffic.filter((plane) => plane.heading >= 25 && plane.heading <= 135).length;
    const westbound = localTraffic.filter((plane) => plane.heading >= 205 && plane.heading <= 315).length;
    if (eastbound >= 2 && eastbound > westbound) return { code: "BR 07", label: copy.east, confidence: copy.inferred };
    if (westbound >= 2 && westbound > eastbound) return { code: "BR 25", label: copy.west, confidence: copy.inferred };
    return { code: "—", label: copy.waiting, confidence: copy.low };
  }, [localTraffic, locale]);
  const peak = DAY_PROFILE.reduce((best, item) => item.value > best.value ? item : best);
  const radiusFactor = Math.min(3, Math.max(.2, statsRadiusKm / 5));
  const operationFactor = operation.code === "BR 25" ? .38 : 1;
  const estimatedCounts = DAY_PROFILE.map((item) => Math.max(0, Math.round(item.value / 100 * 18 * radiusFactor * operationFactor)));
  const estimatedDayTotal = estimatedCounts.reduce((total, count) => total + count, 0);
  const displayedRunways = runwayMode === "major" ? runways.filter((runway) => runway.ref && runway.lengthMeters >= 1200) : runways;
  const t = COPY[locale];
  const detail = DETAIL_COPY[locale];
  const receiver = RECEIVER_COPY[locale];

  function changeLocale(next: Locale) {
    setLocale(next);
    window.localStorage.setItem("aeroradar-locale", next);
  }

  function updateStatsRadius(value: number) {
    if (!Number.isFinite(value)) return;
    const normalized = Math.min(50, Math.max(1, Math.round(value * 10) / 10));
    setStatsRadiusKm(normalized);
    window.localStorage.setItem("aeroradar-stats-radius-km", String(normalized));
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { hasLiveData.current = false; aircraftCache.current = {}; trails.current = {}; requestedRoutes.current.clear(); setRoutes({}); setPosition({ lat: coords.latitude, lon: coords.longitude, label: detail.myLocation }); },
      () => { setPosition(DEMO_CENTER); setLoading(false); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  async function useAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.trim()) return;
    setAddressStatus(detail.finding);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(address.trim())}`);
      const result = await response.json() as { lat?: number; lon?: number; label?: string; error?: string };
      if (!response.ok || result.lat == null || result.lon == null) throw new Error(result.error);
      setPosition({ lat: result.lat, lon: result.lon, label: result.label ?? address.trim() });
      setAddressStatus(detail.centered);
      trails.current = {};
      aircraftCache.current = {};
      hasLiveData.current = false;
      requestedRoutes.current.clear();
      setRoutes({});
    } catch {
      setAddressStatus(detail.notFound);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brandMark">AR</span><div><strong>AERORADAR</strong><small>LOCAL AIRSPACE</small></div></div>
        <div className="headerActions"><div className="status"><span className={`statusDot ${mode}`} /> ADS-B<span className="divider" />15 s</div><div className="languageSwitch" aria-label="Language"><button className={locale === "zh" ? "active" : ""} onClick={() => changeLocale("zh")}>中文</button><button className={locale === "de" ? "active" : ""} onClick={() => changeLocale("de")}>DE</button><button className={locale === "en" ? "active" : ""} onClick={() => changeLocale("en")}>EN</button></div></div>
      </header>

      <section className="heroStrip">
        <div className="heroCopy"><p className="eyebrow">AIRSPACE / {position.lat.toFixed(3)}°, {position.lon.toFixed(3)}°</p><h1>{t.headline}</h1><p>{t.privacy}</p><form className="addressForm" onSubmit={useAddress}><label htmlFor="home-address">{t.address}</label><div><input id="home-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder={t.placeholder} autoComplete="street-address" /><button type="submit">{t.locate}</button><button className="inlineLocation" type="button" onClick={locateMe}>⌖ {t.useLocation}</button></div><small>{addressStatus || "OpenStreetMap Nominatim"}</small></form></div>
        <div className="summary"><div><span>{visible.length}</span><small>{t.nearby}</small></div><div><span>{visible.filter(p => p.altitude < 10000).length}</span><small>{t.low}</small></div><div><span>{visible[0]?.distance.toFixed(1) ?? "—"}</span><small>{t.nearest}</small></div></div>
      </section>

      <section className="forecastPanel" aria-label="今日头顶繁忙度预测">
        <div className="forecastIntro">
          <p>{t.forecast}</p>
          <h2><strong>{peak.hour}:00–{peak.hour + 1}:00</strong> {t.busiest}</h2>
          <span>{position.label} · ~{estimatedDayTotal} · {t.estimate}</span>
          <label className="statsRadiusControl"><span>{t.radius}</span><input aria-label={t.radius} type="number" min="1" max="50" step="1" value={statsRadiusKm} onChange={(event) => updateStatsRadius(event.target.valueAsNumber)} /><b>km</b></label>
          <small className="statsRadiusHint">{t.radiusHint}</small>
        </div>
        <div className="directionCard"><small>{t.direction}</small><strong>{operation.code}</strong><span>{operation.label}</span><em>{operation.confidence}</em></div>
        <div className="hourChart">
          {DAY_PROFILE.map((item, index) => {
            const isNow = currentHour !== null && currentHour === item.hour;
            const adjusted = operation.code === "BR 25" ? Math.round(item.value * .38) : item.value;
            const count = estimatedCounts[index];
            return <div className="hourBar" aria-current={isNow ? "time" : undefined} key={item.hour} title={`${String(item.hour).padStart(2, "0")}:00 · 预计 ${count} 架`}><b>{isNow ? `现在 · ${count}` : count}</b><i style={{ height: `${adjusted}%` }} /><span>{String(item.hour).padStart(2, "0")}</span></div>;
          })}
        </div>
        <div className="forecastLegend"><span><i /> {t.hourly} · {statsRadiusKm} km</span><b>00–23</b><em>{t.fullDay}</em></div>
      </section>

      <section className="workspace">
        <div className="radarPanel">
          <div className="panelHead"><div><span className="livePulse" /> LIVE RADAR</div><span>{position.label}</span></div>
          <div className="radarWrap">
            <div className="radar" aria-label={`${range} 海里范围雷达，共 ${visible.length} 架飞机`}>
              <div className="sweep" />
              {[1, 2, 3, 4].map(i => <div className={`ring r${i}`} key={i} />)}
              <div className="cross horizontal" /><div className="cross vertical" />
              <span className="north">N</span><span className="east">E</span><span className="south">S</span><span className="west">W</span>
              {[.25, .5, .75, 1].map(v => <span key={v} className="rangeLabel" style={{ left: `${50 + 46 * v}%`, top: "50%" }}>{Math.round(range * v)}</span>)}
              {displayedRunways.map((runway) => {
                const startRelative = geoFromCenter(position, runway.start);
                const endRelative = geoFromCenter(position, runway.end);
                if (startRelative.distance > range && endRelative.distance > range) return null;
                const start = polarPoint(startRelative.distance, startRelative.bearing, range);
                const end = polarPoint(endRelative.distance, endRelative.bearing, range);
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                return <div className="runwayMark" key={runway.id} title={`${runway.ref ? `跑道 ${runway.ref}` : "未编号跑道"} · ${runway.lengthMeters} m${runway.surface ? ` · ${runway.surface}` : ""}`} style={{ left: `${start.x}%`, top: `${start.y}%`, width: `${length}%`, transform: `rotate(${angle}deg)` }}><i />{runway.ref && <span>{runway.ref}</span>}</div>;
              })}
              {visible.flatMap((plane) => {
                const points = (plane.trail ?? []).map((trailPoint) => {
                  const relative = geoFromCenter(position, trailPoint);
                  return { ...polarPoint(relative.distance, relative.bearing, range), inRange: relative.distance <= range };
                });
                return points.slice(0, -1).map((start, index) => {
                  const end = points[index + 1];
                  if (!start.inRange || !end.inRange) return null;
                  const dx = end.x - start.x;
                  const dy = end.y - start.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                  const age = (index + 1) / Math.max(points.length - 1, 1);
                  return <i key={`${plane.hex}-trail-${index}`} className={`trailSegment ${selected?.hex === plane.hex ? "highlight" : ""}`} style={{ left: `${start.x}%`, top: `${start.y}%`, width: `${length}%`, opacity: .08 + age * .58, transform: `rotate(${angle}deg)` }} />;
                });
              })}
              {visible.map((plane) => {
                const point = polarPoint(plane.distance, plane.bearing, range);
                const route = routes[plane.flight.trim().toUpperCase()];
                const icon = aircraftIcon(plane.type);
                const displayHeading = visualHeading(plane);
                return <button key={plane.hex} className={`plane ${selected?.hex === plane.hex ? "selected" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%`, transform: `translate(-50%,-50%) rotate(${displayHeading}deg)` }} onClick={() => setSelectedHex(plane.hex)} aria-label={`${plane.flight} · ${icon.label}`}><span className={`aircraftIcon ${icon.kind}`}>{icon.glyph}</span><em style={{ transform: `rotate(${-displayHeading}deg)` }}><b>{plane.flight}</b>{route && <small>{route.origin} → {route.destination}</small>}</em></button>;
              })}
              <div className="homeDot"><i /></div>
            </div>
          </div>
          <div className="radarControls"><div className="controlStack"><div className="rangeControl"><span>{t.range}</span>{RANGES.map(item => <button key={item} className={range === item ? "active" : ""} onClick={() => { setRange(item); loadAircraft(position, item); }}>{item} NM</button>)}</div><div className="runwayControl"><span>{t.runwayLayer}</span><button className={runwayMode === "major" ? "active" : ""} onClick={() => setRunwayMode("major")}>{t.major}</button><button className={runwayMode === "all" ? "active" : ""} onClick={() => setRunwayMode("all")}>{t.all}</button><em>{runwayStatus === "loading" ? t.runwayLoading : runwayStatus === "error" ? t.runwayError : `${t.showing} ${displayedRunways.length} ${t.unitRunway}`}</em></div></div><button className="refresh" onClick={() => loadAircraft(position)}>{loading ? t.scanning : `↻ ${t.refresh}`}</button></div>
          <div className="radarLegend"><strong>{t.legend}</strong><span>✈️ {t.airliner}</span><span><i className="legendSmallPlane">✈️</i> {t.light}</span><span>🚁 {t.helicopter}</span><span><i className="legendRunway" /> {t.runway}</span><span><i className="legendTrail" /> {t.trail}</span><span><i className="legendHome" /> {t.home}</span><em>OpenStreetMap</em></div>
        </div>

        <aside className="detailPanel">
          {selected ? <>
            <div className="flightTitle"><div><p>{t.selected}</p><h2>{selected.flight}</h2>{routes[selected.flight.trim().toUpperCase()] && <strong className="routeTitle">{routes[selected.flight.trim().toUpperCase()].origin} → {routes[selected.flight.trim().toUpperCase()].destination}</strong>}<span>{selected.registration || selected.hex.toUpperCase()} · {selected.type || "—"}</span></div><div className="aircraftGlyph" style={{ transform: `rotate(${visualHeading(selected)}deg)` }}>✈</div></div>
            <div className="metricGrid"><div><small>{t.altitude}</small><strong>{fmtAltitude(selected.altitude)}</strong><span>{selected.verticalRate > 100 ? "↑" : selected.verticalRate < -100 ? "↓" : "→"}</span></div><div><small>{t.speed}</small><strong>{Math.round(selected.speed)} kt</strong><span>{Math.round(selected.speed * 1.852)} km/h</span></div><div><small>{t.heading}</small><strong>{Math.round(visualHeading(selected))}°</strong><span>ADS-B / track</span></div><div><small>{t.distance}</small><strong>{selected.distance.toFixed(1)} NM</strong><span>{(selected.distance * 1.852).toFixed(1)} km</span></div></div>
            <div className="proximity"><div><span>{detail.closest}</span><strong>{detail.bearing} {Math.round(selected.bearing)}°</strong></div><div className="bar"><i style={{ width: `${Math.max(8, 100 - selected.distance / range * 100)}%` }} /></div><p>{Math.round(selected.seen)} {detail.received}</p></div>
            <div className="track"><div><span>{t.trail}</span><em>{selected.trail?.length ?? 1}</em></div><div className="trackLine"><i /><i /><i /><i /><b>✈</b></div></div>
          </> : <div className="empty">{detail.searching}</div>}
          <div className="sourceNote"><span>{detail.source}</span><strong>{mode === "live" ? `ADSB.lol · ${detail.live}` : mode === "stale" ? `ADSB.lol · ${detail.stale}` : detail.demo}</strong><p>{mode === "live" ? detail.sourceLive : mode === "stale" ? detail.sourceStale : detail.sourceDemo}</p></div>
        </aside>
      </section>

      <section className="receiverInfo" aria-label={receiver.title}>
        <div className="receiverIntro"><p>{receiver.eyebrow}</p><h2>{receiver.title}</h2></div>
        <div className="receiverFlow"><span>✈ ADS-B</span><i>→</i><span>1090 MHz</span><i>→</i><span>RTL-SDR</span><i>→</i><span>Raspberry Pi</span><i>→</i><span>AeroRadar</span></div>
        <div className="receiverText"><p>{receiver.body}</p><small>{receiver.note}</small><div><b>{receiver.direct}</b><b>{receiver.local}</b><b>{receiver.fallback}</b></div></div>
      </section>

      <footer><span>{t.lastScan} {updatedAt ? updatedAt.toLocaleTimeString(locale === "zh" ? "zh-CN" : locale === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</span><span>{t.disclaimer}</span></footer>
    </main>
  );
}

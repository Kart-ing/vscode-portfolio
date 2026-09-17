import { ImageResponse } from "next/og";
import { record } from "@/content/record";

export const alt = `${record.owner.name} · ${record.owner.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500;
  style: "normal";
};

// Fetch a subset TTF from Google Fonts at build time. Any failure falls back
// to the renderer's default face rather than failing the build.
async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": "Mozilla/4.0" } },
    ).then((res) => (res.ok ? res.text() : ""));
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/);
    if (!match) return null;
    const res = await fetch(match[1]);
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dots(count: number) {
  const rand = mulberry32(20260916);
  return Array.from({ length: count }, () => {
    const m = rand();
    return {
      x: Math.round(rand() * size.width),
      y: Math.round(rand() * size.height),
      r: m > 0.96 ? 5 : m > 0.8 ? 3 : 2,
      o: m > 0.96 ? 0.95 : 0.3 + rand() * 0.45,
      warm: rand() > 0.78,
    };
  });
}

export default async function Image() {
  const { owner } = record;
  const [display, text] = await Promise.all([
    loadGoogleFont("Bricolage Grotesque:wght@500", owner.name),
    loadGoogleFont("Hanken Grotesk:wght@400", `${owner.role}${owner.tagline}kartikey.fyi`),
  ]);
  const fonts: OgFont[] = [];
  if (display) fonts.push({ name: "Bricolage", data: display, weight: 500, style: "normal" });
  if (text) fonts.push({ name: "Hanken", data: text, weight: 400, style: "normal" });
  const displayFamily = display ? "Bricolage" : "sans-serif";
  const textFamily = text ? "Hanken" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "radial-gradient(80% 90% at 30% 40%, #0d1530 0%, #090e1e 55%, #070b16 100%)",
          overflow: "hidden",
        }}
      >
        {dots(170).map((d, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.x,
              top: d.y,
              width: d.r,
              height: d.r,
              borderRadius: 999,
              background: d.warm ? "#f2c76b" : "#edf0f7",
              opacity: d.o,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            right: 80,
            top: 68,
            fontFamily: textFamily,
            fontSize: 22,
            color: "#7c8599",
          }}
        >
          kartikey.fyi
        </div>
        <div
          style={{
            position: "absolute",
            left: 80,
            bottom: 76,
            right: 80,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontFamily: displayFamily,
              fontSize: 92,
              lineHeight: 1,
              letterSpacing: -2.5,
              color: "#edf0f7",
            }}
          >
            {owner.name}
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: textFamily,
              fontSize: 30,
              color: "#f2c76b",
            }}
          >
            {owner.role}
          </div>
          <div
            style={{
              marginTop: 24,
              maxWidth: 940,
              fontFamily: textFamily,
              fontSize: 26,
              lineHeight: 1.35,
              color: "#a9b1c3",
            }}
          >
            {owner.tagline}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

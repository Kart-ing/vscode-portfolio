// A static, deterministic star field. It is the scene before WebGL loads,
// the scene on devices without WebGL, and the scene for reduced-motion visitors.

const WIDTH = 1600;
const HEIGHT = 1000;

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

interface Dot {
  x: number;
  y: number;
  r: number;
  o: number;
  warm: boolean;
}

function generate(count: number, seed: number): Dot[] {
  const rand = mulberry32(seed);
  const dots: Dot[] = [];
  for (let i = 0; i < count; i += 1) {
    const magnitude = rand();
    const r = magnitude > 0.965 ? 2 : magnitude > 0.8 ? 1.35 : 0.85;
    const o = magnitude > 0.965 ? 0.95 : 0.34 + rand() * 0.5;
    dots.push({
      x: Math.round(rand() * WIDTH * 10) / 10,
      y: Math.round(rand() * HEIGHT * 10) / 10,
      r,
      o: Math.round(o * 100) / 100,
      warm: rand() > 0.78,
    });
  }
  return dots;
}

const DOTS = generate(300, 20260916);

export function Starfield() {
  return (
    <div className="starfield" aria-hidden="true">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="sky" cx="38%" cy="42%" r="70%">
            <stop offset="0%" stopColor="#0d1530" />
            <stop offset="55%" stopColor="#090e1e" />
            <stop offset="100%" stopColor="#070b16" />
          </radialGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#sky)" />
        {DOTS.map((d, i) =>
          d.r > 1.5 ? (
            <g key={i}>
              <circle cx={d.x} cy={d.y} r={d.r * 4.5} fill={d.warm ? "#f2c76b" : "#edf0f7"} opacity={0.07} />
              <circle cx={d.x} cy={d.y} r={d.r} fill={d.warm ? "#f2c76b" : "#edf0f7"} opacity={d.o} />
            </g>
          ) : (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.warm ? "#f2c76b" : "#edf0f7"} opacity={d.o} />
          ),
        )}
      </svg>
    </div>
  );
}

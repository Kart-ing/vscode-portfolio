// GLSL for the scene. Every fragment shader works in linear colour and ends
// with three's colorspace chunk, so the direct path (mobile) and the
// post-processing path (desktop) produce the same colours.

export const starVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSeed;
  attribute float aIndex;
  // x: visibility (ignition * year filter), y: view emphasis, z: citation lock, w: flash
  attribute vec4 aState;
  uniform float uTime;
  uniform float uFocus;
  uniform float uDim;
  uniform float uTwinkle;
  uniform float uSizeScale;
  uniform float uCoreFade;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vIntensity;
  varying float vFocus;
  varying float vCore;
  varying float vLock;

  void main() {
    vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec4 mv = modelViewMatrix * vec4(center, 1.0);
    float t = uTime * (0.55 + aSeed * 0.9) + aSeed * 43.0;
    float tw = 1.0 + uTwinkle * (0.10 * sin(t) + 0.05 * sin(t * 2.63 + 1.7));
    float isFocus = 1.0 - step(0.5, abs(aIndex - uFocus));
    float vis = aState.x;
    float emph = aState.y;
    float lock = aState.z;
    float flash = aState.w;
    float sizeMul = (0.12 + 0.88 * vis) * mix(0.4, 1.0, emph) * (1.0 + 0.9 * flash) * (1.0 + 0.22 * lock);
    float size = aSize * uSizeScale * tw * mix(1.0, 1.2, isFocus) * sizeMul;
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vColor = mix(aColor, vec3(1.0, 0.84, 0.48), lock * 0.55);
    // Up close the 3D form takes over the core; the halo stays.
    vCore = 1.0 - uCoreFade * smoothstep(46.0, 18.0, -mv.z);
    vIntensity = tw * mix(1.0 - 0.55 * uDim, 1.35, isFocus)
      * smoothstep(0.0, 1.0, vis) * mix(0.22, 1.0, emph)
      * (1.0 + 1.8 * flash + 0.45 * lock);
    vFocus = isFocus;
    vLock = lock;
  }
`;

export const starFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vIntensity;
  varying float vFocus;
  varying float vCore;
  varying float vLock;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float edge = smoothstep(1.0, 0.72, d);
    float core = exp(-d * d * 26.0) * vCore;
    float glow = exp(-d * d * 6.5) * 0.55 * mix(0.4, 1.0, vCore);
    float halo = exp(-d * d * 2.4) * 0.16;
    float spikeX = exp(-abs(p.y) * 34.0) * exp(-abs(p.x) * 2.6);
    float spikeY = exp(-abs(p.x) * 34.0) * exp(-abs(p.y) * 2.6);
    float spikes = (spikeX + spikeY) * mix(0.14, 0.34, max(vFocus, vLock));
    float a = (core * 1.7 + glow + halo + spikes) * edge * vIntensity;
    vec3 col = mix(vColor, vec3(1.0), core * 0.8);
    gl_FragColor = vec4(col * a, 1.0);
    #include <colorspace_fragment>
  }
`;

export const pointVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uDrift;
  uniform float uSwirl;
  uniform float uSwirlAngle;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uMaxSize;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec3 p = position;
    float t = uTime * 0.05 + aSeed * 6.2831;
    p += uDrift * vec3(
      sin(t + p.z * 0.05),
      cos(t * 0.8 + p.x * 0.04) * 0.5,
      sin(t * 1.1 + p.y * 0.05)
    ) * 1.6;
    float r = length(p.xz);
    float ang = atan(p.z, p.x) + uSwirlAngle * (0.6 + 30.0 / (r + 6.0));
    float r2 = mix(r, r * 0.55, uSwirl);
    vec3 q = vec3(cos(ang) * r2, p.y * mix(1.0, 0.7, uSwirl), sin(ang) * r2);
    vec4 mv = modelViewMatrix * vec4(q, 1.0);
    float size = aSize * uPixelRatio * uScale / max(-mv.z, 1.0);
    gl_PointSize = clamp(size, 1.0, uMaxSize * uPixelRatio);
    gl_Position = projectionMatrix * mv;
    vAlpha = 0.55 + 0.45 * sin(uTime * (0.4 + aSeed * 0.8) + aSeed * 57.0);
    vSeed = aSeed;
  }
`;

export const pointFragment = /* glsl */ `
  uniform float uOpacity;
  uniform float uBoost;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float a = exp(-d * d * 4.5) * (0.45 + 0.55 * vAlpha) * uOpacity * uBoost;
    vec3 col = mix(uColorA, uColorB, step(0.82, vSeed));
    gl_FragColor = vec4(col * a, 1.0);
    #include <colorspace_fragment>
  }
`;

export const nebulaVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const nebulaFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uNormal;
  uniform vec3 uBase;
  uniform vec3 uTintA;
  uniform vec3 uTintB;
  uniform vec3 uTintC;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < OCTAVES; i++) {
      s += a * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec3 d = normalize(vDir);
    float along = dot(d, uNormal);
    float band = exp(-pow(abs(along) * 2.9, 1.5));
    float f1 = fbm(d * 3.4 + vec3(0.0, uTime * 0.003, 0.0));
    float f2 = fbm(d * 7.5 + vec3(4.2, 1.3, 7.7));
    float f3 = fbm(d * 1.7 + vec3(9.0, 3.0, 1.0));
    float clouds = smoothstep(0.38, 0.82, f1);
    float wisps = smoothstep(0.48, 0.88, f2);
    float warm = smoothstep(0.58, 0.92, f3);
    vec3 col = uBase;
    col += uTintA * clouds * (0.2 + 0.8 * band) * 0.85;
    col += uTintB * wisps * band * 0.7;
    col += uTintC * warm * band * 0.5;
    col *= 0.7 + 0.3 * smoothstep(-1.0, 0.7, d.y);
    col += (hash(d * 613.0) - 0.5) * (1.0 / 255.0);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// ---------------------------------------------------------------- V3

// Solid per-kind forms. One material per kind (uMode), instanced per star.
export const formVertex = /* glsl */ `
  attribute vec3 aTint;
  // x: visibility, y: emphasis, z: focus, w: seed
  attribute vec4 aState;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vTint;
  varying vec4 vState;

  void main() {
    vLocal = position;
    mat4 m = modelMatrix * instanceMatrix;
    vec4 world = m * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(m) * normal);
    vTint = aTint;
    vState = aState;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const formFragment = /* glsl */ `
  uniform float uMode;
  uniform float uTime;
  uniform vec3 uGold;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vTint;
  varying vec4 vState;

  void main() {
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(cameraPosition - vWorld);
    float ndv = max(dot(n, v), 0.0);
    float fresnel = pow(1.0 - ndv, 3.0);
    vec3 key = normalize(vec3(0.45, 0.85, 0.35));
    vec3 fill = normalize(vec3(-0.6, -0.35, 0.55));
    float diff = max(dot(n, key), 0.0);
    float fillD = max(dot(n, fill), 0.0);
    vec3 h = normalize(key + v);
    float spec = pow(max(dot(n, h), 0.0), 56.0);
    float dist = length(cameraPosition - vWorld);
    float far = smoothstep(18.0, 70.0, dist);
    vec3 col;
    if (uMode < 0.5) {
      // Obsidian: near-black, hard gold highlights, gold rim.
      col = vec3(0.010, 0.013, 0.026)
        + vec3(0.025, 0.035, 0.07) * diff
        + vec3(0.03, 0.045, 0.08) * fillD
        + uGold * (spec * 1.1 + fresnel * 0.85);
    } else if (uMode < 1.5) {
      // Crystal: faceted, lit from within.
      float pulse = 0.72 + 0.28 * sin(uTime * 1.7 + vState.w * 6.2832);
      float inner = exp(-length(vLocal) * 2.4) * pulse;
      col = vTint * (0.05 + 0.18 * diff)
        + vTint * inner * 1.1
        + vec3(1.0) * spec * 0.55
        + vTint * fresnel * 0.8;
    } else if (uMode < 2.5) {
      // Gold shard: metallic.
      col = uGold * (0.16 + 0.75 * diff)
        + vec3(1.0, 0.96, 0.84) * spec * 1.0
        + uGold * fresnel * 0.55
        + uGold * 0.14 * fillD;
    } else if (uMode < 3.5) {
      // Planet: soft bands, cool fill.
      float band = 0.5 + 0.5 * sin(vLocal.y * 15.0 + sin(vLocal.x * 5.0 + vState.w * 3.0) * 0.7);
      vec3 base = mix(vTint * 0.3, vTint * 0.62, band);
      col = base * (0.1 + 0.9 * diff)
        + vTint * fresnel * 0.55
        + vec3(0.05, 0.08, 0.15) * fillD
        + vec3(1.0) * spec * 0.25;
    } else if (uMode < 4.5) {
      // Station: brushed metal, tinted rim.
      vec3 base = vec3(0.15, 0.18, 0.25);
      col = base * (0.12 + 0.85 * diff)
        + vTint * fresnel * 0.65
        + vec3(1.0) * spec * 0.55
        + uGold * 0.10 * fillD;
    } else {
      // Dome: lit from within, brightest at the base.
      float glowY = smoothstep(0.75, -0.05, vLocal.y);
      col = vTint * (0.08 + 0.32 * diff)
        + vTint * glowY * 0.55
        + vTint * fresnel * 0.6
        + vec3(1.0) * spec * 0.15;
    }
    // At a distance the form reads as a bright core inside the glow, never a hole.
    col += vTint * far * 0.75;
    col *= vState.x * mix(0.3, 1.0, vState.y) * (1.0 + 0.4 * vState.z);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// Planet rings: a flat annulus with soft edges and faint grooves.
export const planetRingVertex = /* glsl */ `
  attribute vec3 aTint;
  attribute vec4 aState;
  varying vec2 vLocal;
  varying vec3 vTint;
  varying float vVis;

  void main() {
    vLocal = position.xy;
    vTint = aTint;
    vVis = aState.x * mix(0.3, 1.0, aState.y);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

export const planetRingFragment = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vTint;
  varying float vVis;

  void main() {
    float r = length(vLocal);
    float a = smoothstep(0.70, 0.78, r) * smoothstep(1.06, 0.96, r);
    a *= 0.55 + 0.45 * sin(r * 44.0);
    a *= 0.7 * vVis;
    gl_FragColor = vec4(vTint * a, 1.0);
    #include <colorspace_fragment>
  }
`;

// Community: a ring of particles orbiting the star.
export const orbitPointsVertex = /* glsl */ `
  attribute float aAngle;
  attribute float aRadius;
  attribute float aSeed;
  uniform float uTime;
  uniform float uVis;
  uniform float uPixelRatio;
  uniform float uScale;
  varying float vAlpha;

  void main() {
    float ang = aAngle + uTime * (0.22 + aSeed * 0.18);
    float r = aRadius * (1.0 + 0.05 * sin(uTime * 1.3 + aSeed * 6.2832));
    vec3 p = vec3(cos(ang) * r, sin(uTime * 0.9 + aSeed * 12.0) * 0.07, sin(ang) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = uScale * uPixelRatio * (0.6 + aSeed * 0.9) / max(-mv.z, 1.0);
    gl_PointSize = clamp(size, 1.0, 6.0 * uPixelRatio);
    gl_Position = projectionMatrix * mv;
    vAlpha = uVis * (0.55 + 0.45 * sin(uTime * 2.0 + aSeed * 40.0));
  }
`;

export const orbitPointsFragment = /* glsl */ `
  uniform vec3 uTint;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float a = exp(-d * d * 4.0) * vAlpha;
    gl_FragColor = vec4(uTint * a, 1.0);
    #include <colorspace_fragment>
  }
`;

// Rings: ignition shockwaves and repo pulses, camera-facing instanced quads.
export const ringVertex = /* glsl */ `
  // x: radius, y: alpha, z: width, w: gold mix
  attribute vec4 aRing;
  attribute vec3 aColor;
  varying vec2 vUv;
  varying vec4 vRing;
  varying vec3 vColor;

  void main() {
    vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec4 mv = modelViewMatrix * vec4(center, 1.0);
    mv.xy += position.xy * aRing.x;
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vRing = aRing;
    vColor = aColor;
  }
`;

export const ringFragment = /* glsl */ `
  uniform vec3 uGold;
  varying vec2 vUv;
  varying vec4 vRing;
  varying vec3 vColor;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float ring = 1.0 - smoothstep(0.0, vRing.z, abs(d - 0.8));
    float inner = exp(-d * d * 2.5) * 0.10;
    float a = (ring + inner) * vRing.y * smoothstep(1.0, 0.92, d);
    vec3 col = mix(vColor, uGold, vRing.w);
    gl_FragColor = vec4(col * a, 1.0);
    #include <colorspace_fragment>
  }
`;

// Thinking beams: camera-facing ribbons from just in front of the camera to
// a star, with dashes racing along them until the citation locks.
export const beamVertex = /* glsl */ `
  attribute float aT;
  attribute float aSide;
  attribute vec3 aTo;
  // x: alpha, y: lock, z: seed, w: reach
  attribute vec4 aBeam;
  uniform vec3 uFrom;
  uniform float uWidth;
  varying float vT;
  varying float vSide;
  varying vec4 vBeam;

  void main() {
    float t = aT * aBeam.w;
    vec3 span = aTo - uFrom;
    float len = length(span);
    vec3 d = span / max(len, 1e-4);
    vec3 p = uFrom + span * t;
    vec3 viewDir = normalize(cameraPosition - p);
    vec3 side = normalize(cross(d, viewDir));
    vec3 arc = normalize(cross(side, d));
    p += arc * sin(t * 3.14159) * len * 0.03;
    // Width grows with depth, so the ribbon keeps a constant width on screen.
    float depth = length(cameraPosition - p);
    float w = uWidth * depth * (1.0 + 0.6 * aBeam.y);
    p += side * aSide * w;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vT = aT;
    vSide = aSide;
    vBeam = aBeam;
  }
`;

export const beamFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uGold;
  varying float vT;
  varying float vSide;
  varying vec4 vBeam;

  void main() {
    float across = 1.0 - abs(vSide);
    float core = pow(across, 1.7);
    float p = fract(vT * 4.0 - uTime * 1.6 + vBeam.z * 7.0);
    float dash = smoothstep(0.3, 0.92, p) * (1.0 - smoothstep(0.92, 1.0, p));
    float moving = mix(0.22 + 0.78 * dash, 1.0, vBeam.y);
    float fadeIn = smoothstep(0.0, 0.12, vT);
    float racing = 1.0 - smoothstep(0.9, 1.0, vBeam.w);
    float tip = exp(-(1.0 - vT) * 22.0) * racing * (1.0 - vBeam.y);
    float a = (moving * 0.9 + tip * 1.6) * core * fadeIn * vBeam.x * mix(1.0, 1.7, vBeam.y);
    vec3 col = mix(uGold * 0.9, vec3(1.0, 0.97, 0.9), dash * 0.35 + tip * 0.6);
    col = mix(col, uGold * 1.15, vBeam.y * 0.6);
    gl_FragColor = vec4(col * a, 1.0);
    #include <colorspace_fragment>
  }
`;

// Warp streaks: line segments in a tunnel around the intro flight path,
// scrolled and stretched in the vertex shader.
export const streakVertex = /* glsl */ `
  attribute float aEnd;
  attribute float aSeed;
  uniform float uScroll;
  uniform float uWarp;
  uniform float uLength;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec3 p = position;
    float z = mod(p.z + uScroll, 320.0) - 300.0;
    float tail = aEnd * uLength * uWarp * (0.4 + aSeed * 1.2);
    p.z = z - tail;
    float r = length(p.xy);
    vAlpha = (1.0 - aEnd) * smoothstep(1.5, 5.0, r) * (0.35 + 0.65 * aSeed) * smoothstep(-300.0, -120.0, z);
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const streakFragment = /* glsl */ `
  uniform float uWarp;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec3 col = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.86, 0.6), step(0.86, vSeed));
    float a = vAlpha * uWarp;
    gl_FragColor = vec4(col * a, 1.0);
    #include <colorspace_fragment>
  }
`;

// Timeline axis: a soft glowing ribbon.
export const axisVertex = /* glsl */ `
  attribute float aT;
  attribute float aSide;
  uniform vec3 uFrom;
  uniform vec3 uTo;
  uniform float uWidth;
  varying float vT;
  varying float vSide;

  void main() {
    vec3 span = uTo - uFrom;
    vec3 d = normalize(span);
    vec3 p = uFrom + span * aT;
    vec3 viewDir = normalize(cameraPosition - p);
    vec3 side = normalize(cross(d, viewDir));
    p += side * aSide * uWidth;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vT = aT;
    vSide = aSide;
  }
`;

export const axisFragment = /* glsl */ `
  uniform vec3 uGold;
  uniform float uAlpha;
  uniform float uTime;
  varying float vT;
  varying float vSide;

  void main() {
    float across = 1.0 - abs(vSide);
    float line = exp(-pow((1.0 - across) * 4.0, 2.0)) * 0.9 + pow(across, 6.0) * 0.6;
    float ends = smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);
    float shimmer = 0.85 + 0.15 * sin(vT * 40.0 - uTime * 2.0);
    float a = line * ends * shimmer * uAlpha;
    gl_FragColor = vec4(uGold * a, 1.0);
    #include <colorspace_fragment>
  }
`;

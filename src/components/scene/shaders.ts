// GLSL for the scene. Every fragment shader works in linear colour and ends
// with three's colorspace chunk, so the direct path (mobile) and the
// post-processing path (desktop) produce the same colours.

export const starVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSeed;
  attribute float aIndex;
  uniform float uTime;
  uniform float uFocus;
  uniform float uDim;
  uniform float uTwinkle;
  uniform float uSizeScale;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vIntensity;
  varying float vFocus;

  void main() {
    vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec4 mv = modelViewMatrix * vec4(center, 1.0);
    float t = uTime * (0.55 + aSeed * 0.9) + aSeed * 43.0;
    float tw = 1.0 + uTwinkle * (0.10 * sin(t) + 0.05 * sin(t * 2.63 + 1.7));
    float isFocus = 1.0 - step(0.5, abs(aIndex - uFocus));
    float size = aSize * uSizeScale * tw * mix(1.0, 1.2, isFocus);
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vColor = aColor;
    vIntensity = tw * mix(1.0 - 0.55 * uDim, 1.35, isFocus);
    vFocus = isFocus;
  }
`;

export const starFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vIntensity;
  varying float vFocus;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float edge = smoothstep(1.0, 0.72, d);
    float core = exp(-d * d * 26.0);
    float glow = exp(-d * d * 6.5) * 0.55;
    float halo = exp(-d * d * 2.4) * 0.16;
    float spikeX = exp(-abs(p.y) * 34.0) * exp(-abs(p.x) * 2.6);
    float spikeY = exp(-abs(p.x) * 34.0) * exp(-abs(p.y) * 2.6);
    float spikes = (spikeX + spikeY) * mix(0.14, 0.34, vFocus);
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

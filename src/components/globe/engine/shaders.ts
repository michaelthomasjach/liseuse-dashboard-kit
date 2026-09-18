/**
 * Every shader the globe uses.
 *
 * The load-bearing idea in here: arcs and their particles are *not* tessellated on the CPU. Each
 * vertex carries only the arc's two endpoints plus its own parameter `t`, and the great-circle
 * interpolation (slerp) happens in the vertex shader. That is what makes the per-frame CPU cost
 * of the flow layer zero rather than O(flows x segments) — the buffers are written once when the
 * flow set changes and never touched again while the camera spins.
 *
 * Targets GLSL ES 1.00 / WebGL 1 on purpose: no instancing, no transform feedback and no
 * extensions are needed for any of this, and WebGL 1 is available essentially everywhere WebGL 2
 * is, plus a long tail of older mobile GPUs.
 */

/** Shared by every vertex shader — keep in sync with geo.ts's own `lonLatToVec3`. */
const LIB = `
vec3 ll2v(vec2 ll) {
  float p = radians(ll.y);
  float l = radians(ll.x);
  float cp = cos(p);
  return vec3(cp * sin(l), sin(p), cp * cos(l));
}

/* Point at parameter t along the great circle a->b, lifted by a sine bump of height alt. */
vec3 arcPoint(vec3 a, vec3 b, float omega, float so, float t, float alt) {
  vec3 p = so < 1e-4 ? a : (sin((1.0 - t) * omega) * a + sin(t * omega) * b) / so;
  return p * (1.0 + alt * sin(t * 3.14159265));
}

/* 1.0 when visible, 0.0 when hidden behind the sphere. A point is occluded only if it is on the
   far hemisphere AND falls inside the silhouette — an arc arching above the limb is on the far
   side yet perfectly visible, which a naive z<0 test would wrongly cut away. */
float visibility(vec3 r) {
  return r.z < 0.0 ? smoothstep(0.985, 1.02, length(r.xy)) : 1.0;
}
`;

export const SPHERE_VS = `
precision highp float;
attribute vec2 aUv;
uniform float uRadiusPx;
uniform vec2 uViewport;
varying vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aUv * uRadiusPx / uViewport, 0.0, 1.0);
}
`;

export const SPHERE_FS = `
precision highp float;
varying vec2 vUv;
uniform vec3 uCore;
uniform vec3 uEdge;
uniform vec3 uAtmo;
uniform float uBodyAlpha;
uniform float uAtmoAlpha;
uniform float uFeather;
void main() {
  float r = length(vUv);
  if (r > 1.45) discard;
  if (r <= 1.0) {
    float z = sqrt(max(0.0, 1.0 - r * r));
    /* Fixed key light from the upper left. Not physically motivated — it just stops the disc
       reading as a flat circle, which is the entire job of this pass. */
    float lambert = clamp(dot(normalize(vec3(vUv, z)), normalize(vec3(-0.45, 0.55, 0.75))), 0.0, 1.0);
    vec3 col = mix(uEdge, uCore, pow(z, 0.55));
    col += col * lambert * 0.30;
    gl_FragColor = vec4(col, uBodyAlpha * smoothstep(1.0, 1.0 - uFeather, r));
  } else {
    float t = (r - 1.0) / 0.45;
    float glow = exp(-t * 3.4) * (1.0 - t);
    gl_FragColor = vec4(uAtmo, max(0.0, glow) * uAtmoAlpha);
  }
}
`;

export const DOTS_VS = `
precision highp float;
${LIB}
attribute vec3 aPos;
attribute float aWeight;
uniform mat3 uRot;
uniform float uRadiusPx;
uniform vec2 uViewport;
uniform float uPointSize;
varying float vAlpha;
void main() {
  vec3 r = uRot * aPos;
  if (r.z < -0.05) {
    /* Pushed outside the clip volume instead of discarded in the fragment stage: a culled point
       then costs nothing beyond its own vertex invocation. */
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  gl_Position = vec4(r.xy * uRadiusPx / uViewport, 0.0, 1.0);
  vAlpha = aWeight * smoothstep(-0.05, 0.30, r.z);
  gl_PointSize = uPointSize * (0.55 + 0.45 * r.z);
}
`;

export const DOTS_FS = `
precision mediump float;
varying float vAlpha;
uniform vec3 uColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(uColor, vAlpha);
}
`;

export const ARCS_VS = `
precision highp float;
${LIB}
attribute vec2 aA;
attribute vec2 aB;
attribute vec2 aTS;      /* x: parameter along the arc, y: side (-1 / +1) */
attribute vec4 aStyle;   /* x: width px, y: altitude, z: dash count (0 = solid), w: reserved */
attribute vec4 aColor;
uniform mat3 uRot;
uniform float uRadiusPx;
uniform vec2 uViewport;
varying vec4 vColor;
varying float vVis;
varying float vT;
varying float vDash;
void main() {
  vec3 a = ll2v(aA);
  vec3 b = ll2v(aB);
  float omega = acos(clamp(dot(a, b), -1.0, 1.0));
  float so = sin(omega);

  /* The tangent is taken from a forward finite difference, so the last vertex has to look
     backwards or it would sample past the end of the arc and flip the ribbon inside out. */
  float eps = 0.006;
  float t0 = min(aTS.x, 1.0 - eps);
  vec3 q0 = arcPoint(a, b, omega, so, t0, aStyle.y);
  vec3 q1 = arcPoint(a, b, omega, so, t0 + eps, aStyle.y);

  vec3 r0 = uRot * q0;
  vec3 r1 = uRot * q1;
  vec2 s0 = r0.xy * uRadiusPx;
  vec2 s1 = r1.xy * uRadiusPx;

  vec2 d = s1 - s0;
  float len = length(d);
  vec2 dir = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  /* Widened in pixel space, not NDC: NDC is anisotropic whenever the canvas is not square, and
     offsetting there gives a ribbon that visibly thins out as it turns vertical. */
  vec2 px = s0 + nrm * aTS.y * aStyle.x * 0.5;
  gl_Position = vec4(px / uViewport, 0.0, 1.0);

  vVis = visibility(r0);
  vColor = aColor;
  vT = aTS.x;
  vDash = aStyle.z;
}
`;

export const ARCS_FS = `
precision mediump float;
varying vec4 vColor;
varying float vVis;
varying float vT;
varying float vDash;
void main() {
  if (vDash > 0.5 && fract(vT * vDash) > 0.55) discard;
  /* Not cut to nothing on the far side — a faint ghost is what tells you the link continues
     around the back rather than stopping dead at the limb. */
  gl_FragColor = vec4(vColor.rgb, vColor.a * (0.10 + 0.90 * vVis));
}
`;

export const PARTICLES_VS = `
precision highp float;
${LIB}
attribute vec2 aA;
attribute vec2 aB;
attribute vec4 aP;      /* x: phase, y: speed, z: altitude, w: direction (+1 / -1) */
attribute vec4 aColor;
attribute float aSize;
uniform mat3 uRot;
uniform float uRadiusPx;
uniform vec2 uViewport;
uniform float uTime;
varying vec4 vColor;
varying float vVis;
void main() {
  float u = fract(aP.x + uTime * aP.y);
  float t = aP.w > 0.0 ? u : 1.0 - u;

  vec3 a = ll2v(aA);
  vec3 b = ll2v(aB);
  float omega = acos(clamp(dot(a, b), -1.0, 1.0));
  vec3 q = arcPoint(a, b, omega, sin(omega), t, aP.z);
  vec3 r = uRot * q;

  gl_Position = vec4(r.xy * uRadiusPx / uViewport, 0.0, 1.0);
  gl_PointSize = aSize * (0.6 + 0.4 * clamp(r.z, 0.0, 1.0));

  /* Fades in and out at the endpoints so particles do not pop into existence on top of a node. */
  float ends = smoothstep(0.0, 0.10, t) * (1.0 - smoothstep(0.90, 1.0, t));
  vColor = vec4(aColor.rgb, aColor.a * ends);
  vVis = visibility(r);
}
`;

export const PARTICLES_FS = `
precision mediump float;
varying vec4 vColor;
varying float vVis;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float g = pow(1.0 - d, 2.2);
  gl_FragColor = vec4(vColor.rgb * g, vColor.a * g * vVis);
}
`;

export const NODES_VS = `
precision highp float;
${LIB}
attribute vec3 aPos;
attribute vec4 aColor;
attribute vec3 aP;    /* x: diameter px, y: pulse (0/1), z: selected (0/1) */
uniform mat3 uRot;
uniform float uRadiusPx;
uniform vec2 uViewport;
uniform float uTime;
varying vec4 vColor;
varying float vPulse;
varying float vSelected;
void main() {
  vec3 r = uRot * aPos;
  if (r.z < 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec4(0.0);
    vPulse = -1.0;
    vSelected = 0.0;
    return;
  }
  gl_Position = vec4(r.xy * uRadiusPx / uViewport, 0.0, 1.0);
  /* The sprite is 3x the node's nominal diameter to leave room for the ring and the halo. */
  gl_PointSize = aP.x * 3.0;
  vColor = vec4(aColor.rgb, aColor.a * smoothstep(0.0, 0.18, r.z));
  vPulse = aP.y > 0.5 ? fract(uTime * 0.55) : -1.0;
  vSelected = aP.z;
}
`;

export const NODES_FS = `
precision mediump float;
varying vec4 vColor;
varying float vPulse;
varying float vSelected;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;

  float core = 1.0 - smoothstep(0.30, 0.38, d);
  float halo = exp(-pow(d * 2.2, 2.0)) * 0.30;
  float ring = vSelected > 0.5
    ? smoothstep(0.62, 0.68, d) * (1.0 - smoothstep(0.80, 0.88, d))
    : 0.0;

  float pulse = 0.0;
  if (vPulse >= 0.0) {
    float pr = mix(0.36, 0.98, vPulse);
    pulse = smoothstep(pr - 0.07, pr, d) * (1.0 - smoothstep(pr, pr + 0.07, d)) * (1.0 - vPulse);
  }

  float a = clamp(core + ring + halo + pulse * 0.8, 0.0, 1.0) * vColor.a;
  if (a <= 0.003) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}
`;

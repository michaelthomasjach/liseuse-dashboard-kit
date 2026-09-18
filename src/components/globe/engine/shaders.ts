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
/* 1.0 = shaded sphere with a soft atmospheric halo; 0.0 = flat disc with a hairline outline.
   The flat branch is what the e-ink palette asks for: that design language has no gradients and no
   shadows, so a lit sphere in it would read as a different product rather than a darker one. */
uniform float uShading;
void main() {
  float r = length(vUv);
  if (r > 1.45) discard;

  if (r <= 1.0) {
    float z = sqrt(max(0.0, 1.0 - r * r));
    /* Fixed key light from the upper left. Not physically motivated — it just stops the disc
       reading as a flat circle, which is the entire job of this pass. */
    float lambert = clamp(dot(normalize(vec3(vUv, z)), normalize(vec3(-0.45, 0.55, 0.75))), 0.0, 1.0);
    vec3 shaded = mix(uEdge, uCore, pow(z, 0.55));
    shaded += shaded * lambert * 0.30;
    vec3 col = mix(uCore, shaded, uShading);
    gl_FragColor = vec4(col, uBodyAlpha * smoothstep(1.0, 1.0 - uFeather, r));
  } else {
    float d = r - 1.0;
    float t = d / 0.45;
    float glow = max(0.0, exp(-t * 3.4) * (1.0 - t));
    /* A crisp rule a couple of pixels wide, sitting just outside the silhouette. */
    float ring = 1.0 - smoothstep(uFeather * 0.6, uFeather * 2.6, d);
    float a = mix(ring, glow, uShading) * uAtmoAlpha;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(uAtmo, a);
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
  /* Kept well above zero across the visible hemisphere. Fading purely with the facing angle looked
     plausible but cost most of the land/sea contrast: two thirds of every continent sits on the
     part of the sphere turning away from the viewer, so the coastlines that define a landmass were
     exactly the ones dissolving into the ocean. The floor keeps them readable; the remaining ramp
     is enough to round the sphere. */
  vAlpha = aWeight * (0.72 + 0.28 * smoothstep(-0.05, 0.35, r.z));
  /* Scaled by sqrt(z), which is not a taste call but the correction for the projection.
     Orthographic foreshortening compresses the lattice radially by a factor of z near the limb, so
     an evenly spaced sphere lands on screen with density proportional to 1/z there. Ink coverage
     goes as size squared, so size ~ sqrt(z) holds coverage constant and stops the outer eighth of
     every landmass merging into a solid black band. The floor keeps limb dots from vanishing
     entirely. */
  gl_PointSize = uPointSize * sqrt(clamp(r.z, 0.10, 1.0));
}
`;

export const DOTS_FS = `
precision mediump float;
varying float vAlpha;
uniform vec3 uColor;
/* 1.0 = round dots, 0.0 = square. Square is both truer to the e-ink design language and measurably
   higher contrast at these sizes: a 2px round dot loses its corners to the discard below and covers
   roughly 60% of the pixels a square one does. */
uniform float uRound;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (uRound > 0.5 && dot(c, c) > 0.25) discard;
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
/* Extra width, in pixels, for the casing pass — see ARCS_FS. */
uniform float uWidthBoost;
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
  vec2 px = s0 + nrm * aTS.y * (aStyle.x + uWidthBoost) * 0.5;
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
/* The casing pass: the same geometry, drawn wider and in the page colour, underneath the arc
   itself. Over a densely stippled continent an unbacked line is read as more stipple; a thin gap of
   paper on either side is what lets the eye follow it. Standard cartographic practice, and the only
   thing that makes routes legible over land in the monochrome palette. */
uniform float uCasing;
uniform vec3 uCasingColor;
void main() {
  if (vDash > 0.5 && fract(vT * vDash) > 0.55) discard;
  /* Not cut to nothing on the far side — a faint ghost is what tells you the link continues
     around the back rather than stopping dead at the limb. */
  float vis = 0.10 + 0.90 * vVis;
  if (uCasing > 0.5) {
    gl_FragColor = vec4(uCasingColor, vis * 0.92);
    return;
  }
  gl_FragColor = vec4(vColor.rgb, vColor.a * vis);
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
/* 1.0 = soft glow, 0.0 = a crisp disc with a one-pixel edge.
   The glow suits additive blending on a dark ground, where a particle is a point of light. On paper
   the same falloff makes a mark that is faint everywhere and solid nowhere, so the ink palette gets
   a real disc instead. */
uniform float uSoftness;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;

  /* The exponent was 2.2, which left a particle visually about half the diameter it was actually
     drawn at: the falloff had already dropped to 0.22 by the halfway point. 1.5 keeps a readable
     core out to the edge while still reading as a glow rather than a dot. */
  float soft = pow(1.0 - d, 1.5);
  float crisp = 1.0 - smoothstep(0.74, 0.96, d);
  float g = mix(crisp, soft, uSoftness);

  /* Only the additive branch dims the colour itself. Under normal blending, scaling rgb pulls the
     ink toward black instead of toward the page, so there the falloff has to live in the alpha
     alone. */
  gl_FragColor = vec4(vColor.rgb * mix(1.0, g, uSoftness), vColor.a * g * vVis);
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
/* Width of a page-coloured moat drawn around the core, 0 to disable. The soft halo below works by
   adding light, which is meaningless on a light ground — there, separation has to come from
   clearing a ring of paper around the marker instead. */
uniform float uMoat;
uniform vec3 uMoatColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;

  float core = 1.0 - smoothstep(0.30, 0.38, d);
  float halo = exp(-pow(d * 2.2, 2.0)) * 0.30 * (1.0 - uMoat);
  float ring = vSelected > 0.5
    ? smoothstep(0.62, 0.68, d) * (1.0 - smoothstep(0.80, 0.88, d))
    : 0.0;

  float pulse = 0.0;
  if (vPulse >= 0.0) {
    float pr = mix(0.36, 0.98, vPulse);
    pulse = smoothstep(pr - 0.07, pr, d) * (1.0 - smoothstep(pr, pr + 0.07, d)) * (1.0 - vPulse);
  }

  float ink = clamp(core + ring + halo + pulse * 0.8, 0.0, 1.0);
  float moat = uMoat * smoothstep(0.34, 0.40, d) * (1.0 - smoothstep(0.56, 0.64, d));

  /* Weighted so the moat only shows where there is no ink, rather than washing the core out. */
  vec3 col = mix(vColor.rgb, uMoatColor, moat / max(0.001, ink + moat));
  float a = clamp(ink + moat, 0.0, 1.0) * vColor.a;
  if (a <= 0.003) discard;
  gl_FragColor = vec4(col, a);
}
`;

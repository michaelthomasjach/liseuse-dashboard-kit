/** Thin WebGL helpers. Deliberately small — the engine owns the interesting parts. */

export interface GlProgram {
  program: WebGLProgram;
  attrib: (name: string) => number;
  uniform: (name: string) => WebGLUniformLocation | null;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  // Checked before anything else: on a lost context every call below fails with a null info log, and
  // "shader compilation failed — no log" sends you hunting through GLSL for a syntax error that is
  // not there. The context is the problem, so the message has to say so.
  if (gl.isContextLost()) {
    throw new Error(
      "globe: the WebGL context is lost, so shaders cannot be compiled. " +
        "This usually means the canvas was reused after a previous context was released, " +
        "or the GPU driver reset."
    );
  }

  const shader = gl.createShader(type);
  if (!shader) throw new Error("globe: could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    const kind = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    if (gl.isContextLost()) {
      throw new Error(`globe: the WebGL context was lost while compiling the ${kind} shader.`);
    }
    // The source is included because a driver's line numbers are useless without it — the shaders
    // are assembled from a shared prelude plus a per-layer body, so "line 42" refers to neither file.
    throw new Error(
      `globe: ${kind} shader compilation failed — ${log?.trim() || "the driver reported no reason"}\n` +
        `--- source ---\n${numberLines(source)}`
    );
  }
  return shader;
}

/** Prefixes each line with its number, so a driver's "ERROR: 0:37" points somewhere. */
function numberLines(source: string): string {
  return source
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(3, " ")} | ${line}`)
    .join("\n");
}

/** Compiles + links a program and memoises its attribute/uniform locations (they never change for
 *  the life of a program, and `getAttribLocation` is a synchronous driver round-trip). */
export function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): GlProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) throw new Error("globe: could not create program");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`globe: program link failed — ${log ?? "no log"}`);
  }

  const attribs = new Map<string, number>();
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    attrib(name) {
      let loc = attribs.get(name);
      if (loc === undefined) {
        loc = gl.getAttribLocation(program, name);
        attribs.set(name, loc);
      }
      return loc;
    },
    uniform(name) {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
      return uniforms.get(name) ?? null;
    },
  };
}

/** A GPU buffer plus the vertex count currently uploaded into it. */
export class VertexBuffer {
  readonly buffer: WebGLBuffer;
  /** Number of vertices, not floats. */
  count = 0;
  private capacityBytes = 0;

  constructor(private readonly gl: WebGLRenderingContext) {
    const buf = gl.createBuffer();
    if (!buf) throw new Error("globe: could not create buffer");
    this.buffer = buf;
  }

  /**
   * Uploads `data`, reusing the existing allocation whenever it still fits. `bufferSubData` into a
   * buffer that is already big enough avoids a fresh GPU allocation on every data change, which is
   * what keeps re-filtering a few hundred flows from thrashing memory while the user drags a
   * filter slider.
   */
  upload(data: Float32Array, vertexCount: number, usage: number) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const bytes = data.byteLength;
    if (bytes > this.capacityBytes) {
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      this.capacityBytes = bytes;
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
    this.count = vertexCount;
  }

  dispose() {
    this.gl.deleteBuffer(this.buffer);
  }
}

/** One attribute's position inside an interleaved vertex. */
export interface AttribSpec {
  name: string;
  size: number;
  offsetFloats: number;
}

/** Binds an interleaved buffer to a program's attributes in one go. */
export function bindInterleaved(
  gl: WebGLRenderingContext,
  program: GlProgram,
  buffer: WebGLBuffer,
  strideFloats: number,
  specs: AttribSpec[]
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const stride = strideFloats * 4;
  for (const spec of specs) {
    const loc = program.attrib(spec.name);
    if (loc < 0) continue;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, spec.size, gl.FLOAT, false, stride, spec.offsetFloats * 4);
  }
}

/** Releases the attribute slots a previous `bindInterleaved` turned on, so the next program does
 *  not inherit pointers into a buffer it knows nothing about. */
export function unbindAttribs(gl: WebGLRenderingContext, program: GlProgram, specs: AttribSpec[]) {
  for (const spec of specs) {
    const loc = program.attrib(spec.name);
    if (loc >= 0) gl.disableVertexAttribArray(loc);
  }
}

export type Rgba = [r: number, g: number, b: number, a: number];

const colorCache = new Map<string, Rgba>();

/**
 * Resolves any CSS color — including `var(--lq-color-accent)` and `color-mix(...)` — to normalised
 * RGBA, by asking the browser rather than parsing it here.
 *
 * `probeHost` must sit inside the themed subtree: custom properties only resolve against an
 * element that actually inherits them, so probing a detached node would silently return black for
 * every token. Results are cached under the host's active palette/surface so switching theme picks
 * up new values instead of serving stale ones.
 */
export function resolveColor(probeHost: HTMLElement, value: string, fallback: Rgba = [1, 1, 1, 1]): Rgba {
  const root = probeHost.closest<HTMLElement>(".lq-root");
  const key = `${root?.dataset.lqPalette ?? "-"}|${root?.dataset.lqSurface ?? "-"}|${value}`;
  const hit = colorCache.get(key);
  if (hit) return hit;

  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none";
  probe.style.color = value;
  probeHost.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probeHost.removeChild(probe);

  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?\s*\)/.exec(computed);
  if (!m) return fallback;
  let alpha = 1;
  if (m[4] !== undefined) alpha = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  const rgba: Rgba = [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, alpha];
  colorCache.set(key, rgba);
  return rgba;
}

/** Drops memoised colors — call after the theme changes underneath a live globe. */
export function clearColorCache() {
  colorCache.clear();
}

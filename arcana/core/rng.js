// Aleatório com semente (mulberry32 + xmur3). O estado é um número e um contador, então serializa em JSON:
// duas máquinas com a mesma semente e os mesmos lances chegam ao mesmo estado (é o que o duelo online confere).
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class RNG {
  constructor(seed = 'milens') {
    this.seed = String(seed);
    this.s = xmur3(this.seed);
    this.n = 0;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.n++;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  weighted(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  }
  toJSON() { return { seed: this.seed, s: this.s, n: this.n }; }
  static from(o) {
    const r = new RNG(o.seed);
    r.s = o.s;
    r.n = o.n;
    return r;
  }
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function seedCode(len = 8, rand = Math.random) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHA[Math.floor(rand() * ALPHA.length)];
  return s;
}

// FNV-1a de 32 bits sobre JSON com chaves ordenadas
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
export function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
export const stateHash = (obj) => fnv(stableStringify(obj)).toString(16).padStart(8, '0');

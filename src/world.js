// World: the tile map the player builds on. Pure data + edit operations (no sim, no DOM).
var DI = globalThis.DI || (globalThis.DI = {});

DI.World = class {
  constructor(w, h) {
    this.w = w; this.h = h;
    const n = w * h;
    this.rooms = [];
    this.roomAt = new Int16Array(n);      // room index + 1
    this.pd = new Int8Array(n);           // pipe size index + 1 (0 = no pipe)
    this.pk = new Uint8Array(n);          // 0 main, 1 branch E-W, 2 branch N-S
    this.spk = new Uint8Array(n);         // 0 none, 1 sprinkler, 2 fused (open), 3 broken (open)
    this.air = new Uint8Array(n);         // air / nitrogen tubing layer
    this.cut = new Uint8Array(n * 2);     // capped joints: [k*2] = east edge of tile k, [k*2+1] = south edge
    this.partAt = new Int32Array(n);      // part id (0 = none)
    this.parts = new Map();
    this.wires = [];                      // [panelId, deviceId]
    this.nextId = 1;
    this.ver = 1;                         // bump on any topology change
    this.money = 0;
    this.outTemp = 70;                    // outdoor temperature, F
    this.power = true;                    // utility power
  }
  k(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  room(x, y) { const r = this.roomAt[this.k(x, y)]; return r ? this.rooms[r - 1] : null; }
  addRoom(type, x, y, w, h, name) {
    const r = { id: this.rooms.length + 1, type, x, y, w, h, name: name || DI.ROOMS[type].name, temp: 70 };
    this.rooms.push(r);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.roomAt[this.k(i, j)] = r.id;
    return r;
  }
  part(id) { return this.parts.get(id); }
  at(x, y) { return this.inb(x, y) ? this.parts.get(this.partAt[this.k(x, y)]) : undefined; }
  // port directions of a part: { i: dir | -1, o: dir | -1 }
  ports(p) {
    const t = DI.PARTS[p.type].ports;
    if (t === 2) return { i: (3 + p.rot) % 4, o: (1 + p.rot) % 4 };
    if (t === 'o') return { i: -1, o: (1 + p.rot) % 4 };
    if (t === 'i') return { i: (3 + p.rot) % 4, o: -1 };
    return { i: -1, o: -1 };
  }
  // does tile (x,y) offer a pipe connection toward dir?
  offers(x, y, dir) {
    if (!this.inb(x, y)) return false;
    const k = this.k(x, y);
    if (this.pd[k]) { const b = this.pk[k]; return b === 0 || (b === 1 ? (dir & 1) === 1 : (dir & 1) === 0); }
    const p = this.parts.get(this.partAt[k]);
    if (!p) return false;
    const pt = this.ports(p);
    return pt.i === dir || pt.o === dir;
  }
  // Two tiles join when each offers a connection to the other. Branch lines stay inside their own
  // room: only mains (and parts) pass through a wall, so neighbouring systems never join by accident.
  linked(x, y, dir) {
    const nx = x + DI.DX[dir], ny = y + DI.DY[dir];
    if (!this.offers(x, y, dir) || !this.offers(nx, ny, DI.OPP[dir])) return false;
    const a = this.k(x, y), b = this.k(nx, ny);
    if (this.cut[dir === 1 ? a * 2 : dir === 2 ? a * 2 + 1 : dir === 3 ? b * 2 : b * 2 + 1]) return false;
    return !((this.pk[a] || this.pk[b]) && this.roomAt[a] !== this.roomAt[b]);
  }

  canBuild(x, y) { return this.inb(x, y) && !this.partAt[this.k(x, y)]; }
  setPipe(x, y, size, kind, spk) {
    if (!this.canBuild(x, y)) return false;
    const k = this.k(x, y);
    this.pd[k] = size + 1; this.pk[k] = kind || 0;
    if (spk !== undefined) this.spk[k] = spk ? 1 : 0;
    this.ver++; return true;
  }
  // cap (or uncap) the joint on the east (south = true: south) side of tile x,y
  setCut(x, y, south, on) { if (!this.inb(x, y)) return; this.cut[this.k(x, y) * 2 + (south ? 1 : 0)] = on ? 1 : 0; this.ver++; }
  setAir(x, y, on) { if (!this.inb(x, y)) return false; this.air[this.k(x, y)] = on ? 1 : 0; this.ver++; return true; }
  addPart(type, x, y, rot, props) {
    if (!this.inb(x, y)) return null;
    const k = this.k(x, y);
    if (this.partAt[k] || this.pd[k]) return null;
    const p = { id: this.nextId++, type, x, y, rot: rot || 0, p: Object.assign({}, DI.PARTS[type].props, props || {}) };
    if (type === 'dpump') p.p.fuel = 1;
    this.parts.set(p.id, p); this.partAt[k] = p.id; this.ver++;
    return p;
  }
  removePart(id) {
    const p = this.parts.get(id); if (!p) return;
    this.partAt[this.k(p.x, p.y)] = 0; this.parts.delete(id);
    this.wires = this.wires.filter((w) => w[0] !== id && w[1] !== id);
    this.ver++;
  }
  erasePipe(x, y) {
    const k = this.k(x, y); if (!this.pd[k]) return false;
    this.pd[k] = 0; this.pk[k] = 0; this.spk[k] = 0; this.cut[k * 2] = 0; this.cut[k * 2 + 1] = 0; this.ver++; return true;
  }
  // cost of whatever pipe is on a tile (for refunds)
  pipeCost(x, y) {
    const k = this.k(x, y); if (!this.pd[k]) return 0;
    return DI.PIPES[this.pd[k] - 1].cost + (this.spk[k] ? DI.SPK_COST : 0);
  }
  wire(a, b) {
    const pa = this.parts.get(a), pb = this.parts.get(b);
    if (!pa || !pb || a === b) return false;
    let panel = pa.type === 'panel' ? a : pb.type === 'panel' ? b : 0;
    if (!panel) return false;
    const dev = panel === a ? b : a;
    if (this.parts.get(dev).type === 'panel') return false;
    this.wires = this.wires.filter((w) => w[1] !== dev);
    this.wires.push([panel, dev]); this.ver++;
    return true;
  }
  unwire(dev) { const n = this.wires.length; this.wires = this.wires.filter((w) => w[1] !== dev && w[0] !== dev); if (this.wires.length !== n) this.ver++; }
  panelOf(dev) { for (const w of this.wires) if (w[1] === dev) return this.parts.get(w[0]); return null; }
  byType(t) { const o = []; for (const p of this.parts.values()) if (p.type === t) o.push(p); return o; }

  toJSON() {
    const rle = (a) => { const o = []; let i = 0; while (i < a.length) { let j = i; while (j < a.length && a[j] === a[i]) j++; o.push(a[i], j - i); i = j; } return o; };
    return { w: this.w, h: this.h, rooms: this.rooms, pd: rle(this.pd), pk: rle(this.pk), spk: rle(this.spk), air: rle(this.air), cut: rle(this.cut),
      parts: [...this.parts.values()], wires: this.wires, nextId: this.nextId, money: this.money, outTemp: this.outTemp };
  }
  static fromJSON(j) {
    const W = new DI.World(j.w, j.h);
    const un = (r, a) => { let k = 0; for (let i = 0; i < r.length; i += 2) { a.fill(r[i], k, k + r[i + 1]); k += r[i + 1]; } };
    for (const r of j.rooms) W.addRoom(r.type, r.x, r.y, r.w, r.h, r.name);
    un(j.pd, W.pd); un(j.pk, W.pk); un(j.spk, W.spk); un(j.air, W.air); if (j.cut) un(j.cut, W.cut);
    for (const p of j.parts) { W.parts.set(p.id, p); W.partAt[W.k(p.x, p.y)] = p.id; }
    W.wires = j.wires || []; W.nextId = j.nextId; W.money = j.money; W.outTemp = j.outTemp === undefined ? 70 : j.outTemp;
    return W;
  }
};

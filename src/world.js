// World: the tile map the player builds on. Pure data + edit operations (no sim, no DOM).
var DI = globalThis.DI || (globalThis.DI = {});

// Bring a part from an older save up to the current props. Preaction is double interlock only: the
// release mode is dropped and missing setpoints come from the el-el maker preset (the old 20 psi
// supervisory setting sat on the P trip point). Dry valves get the old +/-10 psi window as setpoints.
DI.migratePart = function (p) {
  const q = p.p; if (!q) return p;
  if (p.type === 'prev') {
    delete q.mode;
    if (q.loAir === undefined || q.hiAir === undefined || q.pTrip === undefined) { DI.loadTrim(p, 'el-el'); q.repress = true; }
    if (!DI.TRIMS[q.trim]) q.trim = 'el-el';
    if (q.pLatch === undefined) q.pLatch = false;
    if (q.mech === undefined) q.mech = false;
    if (q.solOut === undefined) q.solOut = false;
    if (q.mrzL === undefined) q.mrzL = false;
    if (q.avc === undefined) q.avc = 1;                               // an AVC is fitted, its bypass closed
    if (q.avcBy === undefined) q.avcBy = 0;
    if (q.avcTamper === undefined) q.avcTamper = 0;                   // Cycle 7: no tamper switch on the bypass
    if (q.wfL === undefined) q.wfL = false;                           // Cycle 7: no waterflow latch held
  } else if (p.type === 'comp' || p.type === 'n2') {
    if (q.fault === undefined) q.fault = false;
    if (p.type === 'comp' && !(q.cutOut >= 0)) q.cutOut = 0;          // compressor cut-out: none
    if (p.type === 'comp') { if (!(q.maxPsi >= 0)) q.maxPsi = 0; if (!(q.relief >= 0)) q.relief = 0; }      // Cycle 7: not modeled, so an open bypass drifts to 60 psi as before
  } else if (p.type === 'panel') {
    if (!Array.isArray(q.chan) || q.chan.length !== 2) q.chan = [1, 1];   // both DACT channels up
    // Cycle 6: the battery pick and the ASSUMED loads of the standby calculation, charger and battery healthy
    const L = DI.PANEL_LOADS; if (!(q.ah > 0)) q.ah = L.ah; if (!(q.iStby > 0)) q.iStby = L.iStby; if (!(q.iAlarm > 0)) q.iAlarm = L.iAlarm;
    if (q.chgFail === undefined) q.chgFail = false; if (q.battDisc === undefined) q.battDisc = false;
    if (!(q.chgA >= 0)) q.chgA = 0;                                   // Cycle 7: charger matched to the battery
    // Cycle 8: the notification circuit of the voltage-drop check, off (a Cycle 7 save raises no finding)
    if (!(q.nacOn >= 0)) q.nacOn = 0; if (!(q.nacAwg > 0)) q.nacAwg = 14; if (!(q.nacFt > 0)) q.nacFt = 200; if (!(q.nacN > 0)) q.nacN = 8; if (!(q.nacCd > 0)) q.nacCd = 75; if (!(q.nacV >= 0)) q.nacV = 0;
  } else if (p.type === 'wetv') {
    if (q.wfL === undefined) q.wfL = false;
  } else if (p.type === 'dryv') {
    const win = 10;                       // the supervisory window older saves used on either side of normal
    if (q.hiAir === undefined) q.hiAir = q.airSet + win;
    if (q.loAir === undefined) q.loAir = q.airSet - win;
    if (q.avc === undefined) q.avc = 1;
    if (q.avcBy === undefined) q.avcBy = 0;
    if (q.avcTamper === undefined) q.avcTamper = 0;
    if (q.wfL === undefined) q.wfL = false;
  }
  return p;
};

DI.SAVE_V = 8;
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
    // site / project settings: edition, ed72, nfpa76Adopted, pipeCut, detThr, spotThr, asdModel, sigClass, fitPct, trimGal,
    // insurer, manualReleaseBypassP, commPath, acDelayMin, dactHold, standby, panelGen, refillSeq, ownerRefill, nec and the
    // two hook elections of cause.js. Read them through
    // the DI helpers, which supply the defaults. (An old save may still carry the retired NFPA 76 stage key: nothing reads it.)
    this.cfg = {};
  }
  k(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  room(x, y) { const r = this.roomAt[this.k(x, y)]; return r ? this.rooms[r - 1] : null; }
  addRoom(type, x, y, w, h, name) {
    // a Refrigerated Space room (type `cold`) carries `below5` (held below 5 F), default false: see DI.refillLimit
    // a Telecom / MMR room (type `tel`) may carry `n76` (true / false: NFPA 76 applies here; absent = the site setting),
    // and any room may carry `f1` (the VEA Fire 1 pick of that room; absent = none): see DI.n76Applies, DI.veaFire1At
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
    if (type === 'panel') p.p.chan = (props && Array.isArray(props.chan) ? props.chan : [1, 1]).slice();      // its own array, not the catalogue's
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
    return DI.pipeAt(this, k).cost + (this.spk[k] ? DI.SPK_COST : 0);
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
    // v = the save format (8 since Cycle 8): World.fromJSON runs the NFPA 76 migration only on a save without it
    return { v: DI.SAVE_V, w: this.w, h: this.h, rooms: this.rooms, pd: rle(this.pd), pk: rle(this.pk), spk: rle(this.spk), air: rle(this.air), cut: rle(this.cut),
      parts: [...this.parts.values()], wires: this.wires, nextId: this.nextId, money: this.money, outTemp: this.outTemp, power: this.power, cfg: this.cfg };
  }
  static fromJSON(j) {
    const W = new DI.World(j.w, j.h);
    const un = (r, a) => { let k = 0; for (let i = 0; i < r.length; i += 2) { a.fill(r[i], k, k + r[i + 1]); k += r[i + 1]; } };
    // (a cold room saved under the Cycle 7 default name gets the new one: the name must not say a cold dock qualifies)
    for (const r of j.rooms) { const room = W.addRoom(r.type, r.x, r.y, r.w, r.h, r.type === 'cold' && r.name === DI.COLD_OLD_NAME ? undefined : r.name); if (r.below5 === true) room.below5 = true;
      if (r.n76 === true || r.n76 === false) room.n76 = r.n76; if (typeof r.f1 === 'number') room.f1 = r.f1; }
    un(j.pd, W.pd); un(j.pk, W.pk); un(j.spk, W.spk); un(j.air, W.air); if (j.cut) un(j.cut, W.cut);
    for (const p of j.parts) { DI.migratePart(p); W.parts.set(p.id, p); W.partAt[W.k(p.x, p.y)] = p.id; }
    W.cfg = Object.assign({}, j.cfg || {}); delete W.cfg.pipePolicy;      // the role-based schedule policy is gone: an old save gets the default size cut
    // Cycle 7: the site refrigerated flag became a per-zone rule (a freezer room held below 5 F). An old save that had
    // it set loads with the flag deleted and every zone at 30 min; Sim.restore says so once (W.notes). ASSUMED migration.
    if (W.cfg.refrigerated === true) W.notes = [DI.COLD_MIGRATED];
    delete W.cfg.refrigerated;
    // Cycle 8: NFPA 76 applies by room (a telecom room), and the site flag is only the default for telecom rooms. A
    // save from before that (no `v`) with the flag on: (1) a VEA site with no stored Fire 1 pick read 0.5 everywhere
    // through the flag, so 0.5 is written as the site pick and every room keeps the sensitivity it had; (2) it has
    // no telecom room, so no room is checked any more: Sim.restore says so once (W.notes). Flag off: nothing changes.
    if (!(j.v >= 8) && W.cfg.nfpa76Adopted === true) {
      const notes = [];
      if (!W.rooms.some((r) => r.type === 'tel')) notes.push(DI.N76_MIGRATED);
      if (DI.isVea(W) && DI.veaSitePick(W) === null) { const t = DI.VESDA_T.slice(); t[2] = DI.VEA_TEL; W.cfg.detThr = t; notes.push(DI.N76_PICK_KEPT); }
      if (notes.length) W.notes = (W.notes || []).concat(notes);
    }
    W.wires = j.wires || []; W.nextId = j.nextId; W.money = j.money; W.outTemp = j.outTemp === undefined ? 70 : j.outTemp;
    W.power = j.power !== false;          // utility power is saved with the world; a save from before that has no field and reads on
    return W;
  }
};

/* Apps Script の最小モック（Node とブラウザの両方で動く）。テスト専用。 */
(function (root) {
  function utf8(s) { return Array.from(new TextEncoder().encode(String(s))); }
  function fromUtf8(b) { return new TextDecoder().decode(Uint8Array.from(b.map(function (x) { return x & 255; }))); }

  /* ---- SHA-256 / HMAC（純JS） ---- */
  var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function sha256(bytes) {
    var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var m = bytes.slice(), l = m.length * 8;
    m.push(0x80);
    while (m.length % 64 !== 56) m.push(0);
    for (var i = 7; i >= 0; i--) m.push(i > 3 ? 0 : (l >>> (i * 8)) & 255);
    for (var o = 0; o < m.length; o += 64) {
      var w = new Array(64);
      for (var t = 0; t < 16; t++) w[t] = (m[o + 4*t] << 24) | (m[o + 4*t + 1] << 16) | (m[o + 4*t + 2] << 8) | m[o + 4*t + 3];
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t-15], 7) ^ rotr(w[t-15], 18) ^ (w[t-15] >>> 3);
        var s1 = rotr(w[t-2], 17) ^ rotr(w[t-2], 19) ^ (w[t-2] >>> 10);
        w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = [];
    h.forEach(function (x) { out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255); });
    return out;
  }
  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    while (key.length < 64) key.push(0);
    var ip = key.map(function (b) { return b ^ 0x36; }), op = key.map(function (b) { return b ^ 0x5c; });
    return sha256(op.concat(sha256(ip.concat(msg))));
  }
  function signed(b) { return b.map(function (x) { return x > 127 ? x - 256 : x; }); }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64enc(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var a = bytes[i] & 255, b = bytes[i + 1], c = bytes[i + 2];
      var n = (a << 16) | ((b === undefined ? 0 : b & 255) << 8) | (c === undefined ? 0 : c & 255);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? '=' : B64[(n >> 6) & 63]) + (c === undefined ? '=' : B64[n & 63]);
    }
    return out;
  }
  function b64dec(s) {
    var out = [], buf = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i]; if (ch === '=') break;
      var v = B64.indexOf(ch); if (v < 0) throw new Error('bad base64');
      buf = (buf << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
    }
    return out;
  }

  function makeEnv(code, opts) {
    opts = opts || {};
    var clock = { now: Date.now() };
    var props = {}, cache = {}, lockHeld = false;
    var stats = { sheetCalls: 0, created: 0 };

    function Sheet(name, id) {
      this.name = name; this.id = id; this.maxR = 1000; this.maxC = 26; this.rows = []; this.frozen = 0; this.plain = false;
    }
    Sheet.prototype.getMaxRows = function () { return this.maxR; };
    Sheet.prototype.getMaxColumns = function () { return this.maxC; };
    Sheet.prototype.insertColumnsAfter = function (p, n) { this.maxC += n; };
    Sheet.prototype.insertRowsAfter = function (p, n) { this.maxR += n; };
    Sheet.prototype.setFrozenRows = function (n) { this.frozen = n; };
    Sheet.prototype.getSheetId = function () { return this.id; };
    Sheet.prototype.getLastRow = function () {
      for (var i = this.rows.length - 1; i >= 0; i--) {
        if ((this.rows[i] || []).some(function (v) { return v !== '' && v != null; })) return i + 1;
      }
      return 0;
    };
    Sheet.prototype.deleteRow = function (r) { if (r < 1 || r > this.maxR) throw new Error('row out of range'); this.rows.splice(r - 1, 1); };
    Sheet.prototype.clear = function () { this.rows = []; this.plain = false; };
    Sheet.prototype.getRange = function (r, c, nr, nc) {
      var sh = this; nr = nr || 1; nc = nc || 1;
      if (r < 1 || c < 1 || nr < 1 || nc < 1 || r + nr - 1 > sh.maxR || c + nc - 1 > sh.maxC) {
        throw new Error('The coordinates of the range are outside the dimensions of the sheet. (' + r + ',' + c + ',' + nr + ',' + nc + ' max ' + sh.maxR + 'x' + sh.maxC + ')');
      }
      stats.sheetCalls++;
      return {
        setNumberFormat: function (f) { if (f === '@') sh.plain = true; return this; },
        setValues: function (vals) {
          if (vals.length !== nr || vals.some(function (row) { return row.length !== nc; })) throw new Error('number of rows/columns mismatch');
          vals.forEach(function (row, i) {
            var R = sh.rows[r - 1 + i] = sh.rows[r - 1 + i] || [];
            row.forEach(function (v, j) {
              if (typeof v === 'string' && v.length > 50000) throw new Error('cell too long: ' + v.length);
              R[c - 1 + j] = sh.plain && v !== '' && v != null ? String(v) : (v == null ? '' : v);
            });
          });
          return this;
        },
        setValue: function (v) { return this.setValues([[v]]); },
        getValues: function () {
          var out = [];
          for (var i = 0; i < nr; i++) {
            var row = [];
            for (var j = 0; j < nc; j++) { var v = (sh.rows[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined || v === null ? '' : v); }
            out.push(row);
          }
          return out;
        }
      };
    };
    var sheetsets = {};
    function Spread(name, id) { this.name = name; this.id = id; this.sheets = [new Sheet('シート1', 1)]; this.nextId = 2; }
    Spread.prototype.getId = function () { return this.id; };
    Spread.prototype.getUrl = function () { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; };
    Spread.prototype.getSheetByName = function (n) { return this.sheets.filter(function (s) { return s.name === n; })[0] || null; };
    Spread.prototype.getSheets = function () { return this.sheets; };
    Spread.prototype.insertSheet = function (n) { var s = new Sheet(n, this.nextId++); this.sheets.push(s); return s; };
    Spread.prototype.deleteSheet = function (s) { this.sheets = this.sheets.filter(function (x) { return x !== s; }); };

    var RealDate = Date;
    function FakeDate() {
      var a = Array.prototype.slice.call(arguments);
      if (!(this instanceof FakeDate)) return new RealDate(clock.now).toString();
      return a.length ? new (Function.prototype.bind.apply(RealDate, [null].concat(a)))() : new RealDate(clock.now);
    }
    FakeDate.now = function () { return clock.now; };
    FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
    var G = {
      Date: FakeDate,
      ScriptApp: { getService: function () { return { getUrl: function () { return 'https://script.google.com/macros/s/MOCK/exec'; } }; } },
      Logger: { log: function () {} },
      SpreadsheetApp: {
        create: function (n) { var id = 'ss' + (++stats.created); var s = new Spread(n, id); sheetsets[id] = s; return s; },
        openById: function (id) { if (!sheetsets[id]) throw new Error('not found'); return sheetsets[id]; }
      },
      PropertiesService: { getScriptProperties: function () { return {
        getProperty: function (k) { return Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null; },
        setProperty: function (k, v) { props[k] = String(v); } }; } },
      CacheService: { getScriptCache: function () { return {
        get: function (k) { var e = cache[k]; if (!e || e.exp < clock.now) return null; return e.v; },
        put: function (k, v, ttl) { cache[k] = { v: String(v), exp: clock.now + (ttl || 600) * 1000 }; },
        remove: function (k) { delete cache[k]; } }; } },
      LockService: { getScriptLock: function () { return {
        waitLock: function () { if (lockHeld) throw new Error('Lock timeout (re-entrant)'); lockHeld = true; },
        releaseLock: function () { lockHeld = false; } }; } },
      HtmlService: { createHtmlOutputFromFile: function () { var o = { setTitle: function () { return o; }, addMetaTag: function () { return o; }, setXFrameOptionsMode: function () { return o; } }; return o; }, XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' } },
      Utilities: {
        DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
        computeDigest: function (alg, v) { return signed(sha256(typeof v === 'string' ? utf8(v) : v.map(function (x) { return x & 255; }))); },
        computeHmacSha256Signature: function (v, k) { return signed(hmac(utf8(k), utf8(v))); },
        base64EncodeWebSafe: function (v) { return b64enc(typeof v === 'string' ? utf8(v) : v); },
        base64DecodeWebSafe: function (s) { return signed(b64dec(s)); },
        newBlob: function (bytes) { return { getDataAsString: function () { return fromUtf8(bytes); } }; },
        getUuid: function () { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }); }
      }
    };

    var src = String(code);
    if (opts.admin != null) src = src.replace("const ADMIN_PASSCODE = '';", "const ADMIN_PASSCODE = " + JSON.stringify(opts.admin) + ";");
    if (opts.join != null) src = src.replace("const JOIN_CODE = '';", "const JOIN_CODE = " + JSON.stringify(opts.join) + ";");
    var names = [], re = /^function\s+(\w+)/gm, m;
    while ((m = re.exec(src))) names.push(m[1]);
    var keys = Object.keys(G);
    var fns = new Function(keys.join(','), src + '\nreturn {' + names.map(function (n) { return n + ':' + n; }).join(',') + '};').apply(null, keys.map(function (k) { return G[k]; }));

    function rt(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
    return {
      fns: fns, clock: clock, stats: stats, sheetsets: sheetsets, props: props, cache: cache,
      advance: function (ms) { clock.now += ms; },
      call: function (name) {
        var args = Array.prototype.slice.call(arguments, 1).map(rt);
        if (typeof fns[name] !== 'function') throw new Error('no such function ' + name);
        if (name.slice(-1) === '_') throw new Error('private function ' + name);
        return rt(fns[name].apply(null, args));
      },
      sheet: function (n) { var id = props.SS_ID; return id ? sheetsets[id].getSheetByName(n) : null; }
    };
  }
  var api = { makeEnv: makeEnv, sha256: sha256, utf8: utf8 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GasMock = api;
})(typeof window !== 'undefined' ? window : globalThis);

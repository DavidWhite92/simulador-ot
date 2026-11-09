import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { readCustomPhoto, MAX_PHOTO_BYTES } from '../src/lib/customPhoto.js';

for (const simulator of ['SimuladorOT.jsx', 'SimuladorOT_RTVE.jsx']) {
  test(`${simulator}: group songs are unique, excluded from assignments and survive saving`, () => {
    const source = readFileSync(new URL(`../src/${simulator}`, import.meta.url), 'utf8');
    const helpers = source.slice(source.indexOf('const normSong ='), source.indexOf('// Busca qué canción'));
    const context = vm.createContext({});
    vm.runInContext(`${helpers}\nglobalThis.assign = buildRepartoConCanciones;`, context);
    const allSongs = Array.from({ length: 500 }, (_, i) => `«Tema ${i}» (Artista ${i})`);
    let summaries = {};
    const used = new Set();
    for (let galaNum = 0; galaNum <= 17; galaNum++) {
      const reparto = [
        ...Array.from({ length: 18 }, (_, i) => ({ type: 'solo', members: [`c${i}`] })),
        { type: 'duo', members: ['c0', 'c1'] },
        { type: 'solo', members: ['c0'] },
      ];
      const result = context.assign({ galaNum, reparto, summaries, allSongs });
      assert.ok(allSongs.includes(result.groupSong));
      const assignedSongs = [result.groupSong, ...result.reparto.map(row => row.song)];
      assert.equal(new Set(assignedSongs).size, assignedSongs.length);
      for (const song of assignedSongs) {
        assert.ok(!used.has(song), `Repeated song in gala ${galaNum}: ${song}`);
        used.add(song);
      }
      assert.equal(result.reparto.length, reparto.length);
      summaries[galaNum] = { [galaNum]: result };
      summaries = JSON.parse(JSON.stringify(summaries));
      assert.equal(summaries[galaNum][galaNum].groupSong, result.groupSong);
    }
  });
}

test('device photos reject oversize files and non-image types', async () => {
  await assert.rejects(readCustomPhoto({ size: MAX_PHOTO_BYTES + 1, type: 'image/png' }), /5 MB/);
  await assert.rejects(readCustomPhoto({ size: 10, type: 'text/plain' }), /archivo de imagen/);
});

test('device photos resize proportionally and release temporary URLs on success and failure', async t => {
  let released = 0;
  let canvas;
  let fail = false;
  t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(URL, 'revokeObjectURL', () => { released++; });
  globalThis.Image = undefined;
  globalThis.document = undefined;
  t.after(() => { delete globalThis.Image; delete globalThis.document; });
  t.mock.property(globalThis, 'Image', class {
    naturalWidth = 1200;
    naturalHeight = 600;
    set src(value) { queueMicrotask(() => fail ? this.onerror() : this.onload()); }
  });
  t.mock.property(globalThis, 'document', {
    createElement() {
      canvas = { getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/webp;base64,test' };
      return canvas;
    },
  });
  assert.equal(await readCustomPhoto({ size: MAX_PHOTO_BYTES, type: 'image/png' }), 'data:image/webp;base64,test');
  assert.equal(canvas.width, 512);
  assert.equal(canvas.height, 256);
  assert.equal(released, 1);
  fail = true;
  await assert.rejects(readCustomPhoto({ size: 10, type: 'image/heic' }), /no puede leer/);
  assert.equal(released, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {suspendedNominationLabel} from '../src/lib/suspendedNominations.js';
const cast=[{id:'fav',gender:'f'},{id:'saved',gender:'m'},{id:'jury',gender:'f'},{id:'falseNom',gender:'m'},{id:'out',gender:'f'}];
const summary={favoritoId:'fav',favoritePct:23.45,falseNominees:['falseNom'],duel:{a:'saved',b:'out',winner:'saved',pctA:68.2,pctB:31.8},duelSaved:{jury:55}};
test('Gala 8 suspended nominations distinguish favorite, duel winner and all jury saves',()=>{
  assert.equal(suspendedNominationLabel('fav',summary,cast),'Favorita del Público (23.45%)');
  assert.equal(suspendedNominationLabel('saved',summary,cast),'Salvado por el Público (68.20%) > Salvado por el Jurado > Nominaciones Suspendidas');
  assert.equal(suspendedNominationLabel('jury',summary,cast),'Salvada por el Jurado > Nominaciones Suspendidas');
  assert.equal(suspendedNominationLabel('falseNom',summary,cast),'Salvado por el Jurado > Nominaciones Suspendidas');
  assert.equal(suspendedNominationLabel('out',summary,cast),'Expulsada por el Público (31.80%)');
});
test('favorite percentage follows the contestant rather than the shuffled top-three order',()=>{
  const s={favoritoId:'fav',top3Ids:['jury','fav','saved'],top3Pct:[40,30,20]};
  assert.equal(suspendedNominationLabel('fav',s,cast,[{id:'fav',pct:37.6}]),'Favorita del Público (37.60%)');
  assert.equal(suspendedNominationLabel('fav',s,cast),'Favorita del Público (40.00%)');
});

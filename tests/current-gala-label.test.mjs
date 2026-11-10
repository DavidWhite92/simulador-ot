import test from 'node:test';
import assert from 'node:assert/strict';
import { currentGalaLabel } from '../src/lib/currentGalaLabel.js';
test('old public-save percentages are removed while the current gala result remains intact',()=>{
  const text='Salvado por el público (65.97%) > Salvado por el jurado';
  assert.equal(currentGalaLabel(text,'juanjo',{duelSaved:{juanjo:65.97}}),'Salvado por el jurado');
  assert.equal(currentGalaLabel(text,'juanjo',{duel:{winner:'juanjo'}}),text);
  const nomination='Salvada por el Público (61.00%) > Propuesta por el Jurado > Nominada';
  assert.equal(currentGalaLabel(nomination,'a',{duel:{winner:'b'}}),'Propuesta por el Jurado > Nominada');
});
test('favourite, return and expulsion percentages are not stripped',()=>{
  for(const text of ['Favorita del Público (40.13%)','Repescado por el Público (65.73%) > Salvado por el Jurado','Expulsada por el Público (34.27%)']) assert.equal(currentGalaLabel(text,'a',{}),text);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {contestantFlags} from '../src/lib/contestantStatus.js';
import {repechageColumnsVisible, visibleGalas} from '../src/lib/seasonSchedule.js';

test('eliminated contestants never retain nomination or favorite decorations',()=>{
  const summaries={9:{favoritoId:'a'}};
  for (const status of ['eliminado','finalista','ganador']) {
    assert.deepEqual(contestantFlags({id:'a',status},9,summaries,['a']),{isFav:false,isNom:false});
  }
  assert.equal(contestantFlags({id:'a',status:'active'},9,summaries,[]).isNom,false);
  assert.equal(contestantFlags({id:'a',status:'active'},10,{},['a']).isNom,true);
});

test('favorite frames use the current gala and end when favorites end',()=>{
  const c={id:'a',status:'active'};
  assert.equal(contestantFlags(c,11,{11:{favoritoId:'a'}}).isFav,true);
  assert.equal(contestantFlags(c,12,{11:{favoritoId:'a'},12:{favoritoId:'a'}}).isFav,false);
  assert.equal(contestantFlags(c,10,{9:{favoritoId:'a'}}).isFav,false);
});

test('random repechage leaves both calendars unchanged until its announcement',()=>{
  for(const final of [15,17]) {
    for(const outcome of [true,false]) {
      const hidden=repechageColumnsVisible('random',outcome,{});
      assert.deepEqual(visibleGalas(final,hidden),visibleGalas(final,false));
    }
    assert.deepEqual(visibleGalas(final,repechageColumnsVisible('random',true,{repechageAnnounced:true})),visibleGalas(final,true));
  }
  assert.equal(repechageColumnsVisible('random',false,{repechageAnnounced:true}),false);
  assert.equal(repechageColumnsVisible('on',true,{}),true);
  assert.equal(repechageColumnsVisible('off',false,{}),false);
  assert.equal(repechageColumnsVisible('random',true,{falseNominees:['a','b','c','d']}),true);
});

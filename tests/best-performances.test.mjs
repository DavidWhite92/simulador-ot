import test from 'node:test';
import assert from 'node:assert/strict';
import {bestPerformances} from '../src/lib/bestPerformances.js';

const act=(song,...scores)=>({song,members:scores.map((score,i)=>({id:`c${i}`,score}))});
test('top ten prioritizes incredible performances and fills remaining places with very good ones',()=>{
  const weeks={0:{performances:[act('Entrada',9.5)]},1:{performances:[act('Buena',7.9),act('Dúo',10,8),act('Increíble',9.8),...Array.from({length:12},(_,i)=>act(`Muy buena ${i}`,8+i/20))]}};
  const snapshot=JSON.stringify(weeks);
  const ranking=bestPerformances(weeks);
  assert.equal(ranking.length,10);
  assert.deepEqual(ranking.slice(0,3).map(p=>p.song),['Increíble','Entrada','Dúo']);
  assert.equal(ranking[2].score,9);
  assert.equal(ranking[2].quality,'muy buena');
  assert.ok(!ranking.some(p=>p.song==='Buena'));
  assert.equal(JSON.stringify(weeks),snapshot);
});
test('includes repechage and separate performances of the same finalist without inventing entries',()=>{
  const weeks={15:{performances:[act('Primera',9.2),act('Segunda',9.7)]}};
  const summaries={8:{repechage:{performances:[act('Regreso',10)]}}};
  const ranking=bestPerformances(weeks,summaries);
  assert.equal(ranking.length,3);
  assert.equal(ranking[0].repechage,true);
  assert.equal(ranking[0].gala,8);
  assert.deepEqual(bestPerformances(),[]);
  assert.deepEqual(bestPerformances({1:{performances:[act('Correcta',6),act('Sin notas',undefined)]}}),[]);
});

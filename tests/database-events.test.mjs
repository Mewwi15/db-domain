import assert from 'node:assert/strict';
import test from 'node:test';
import { appendDatabaseEvent } from '../src/lib/database-events.ts';

const empty = () => ({events:[],eventCount:0,revisions:{},schemaRevisions:{}});

test('changes from unselected tables are retained with their actual schema and table', () => {
  let state = empty();
  for (const [schema,table,type] of [['public','profiles','INSERT'],['public','classrooms','UPDATE'],['archive','profiles','DELETE']]) {
    state = appendDatabaseEvent(state,{schema,table,type,time:'2026-11-05T00:00:00Z'});
  }
  assert.equal(state.eventCount,3);
  assert.equal(state.revisions['["public","profiles"]'],1);
  assert.equal(state.revisions['["archive","profiles"]'],1);
  assert.equal(state.schemaRevisions.public,2);
  assert.deepEqual(state.events.map(event => event.table),['profiles','classrooms','profiles']);
  assert.equal(state.events[0].schema,'archive');
});

test('event history stays bounded while all-table and per-table counters keep advancing', () => {
  let state = empty();
  for (let i=0;i<250;i++) state=appendDatabaseEvent(state,{schema:'public',table:i%2?'profiles':'classrooms',type:'UPDATE',time:String(i)});
  assert.equal(state.events.length,50);
  assert.equal(state.events[0].id,250);
  assert.equal(state.events.at(-1).id,201);
  assert.equal(state.eventCount,250);
  assert.equal(state.revisions['["public","profiles"]'],125);
  assert.equal(state.schemaRevisions.public,250);
});

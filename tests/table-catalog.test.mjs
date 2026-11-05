import assert from 'node:assert/strict';
import test from 'node:test';
import { identifyRows, mergeTables, parseTableList, parseDatabaseCatalog, tableId } from '../src/lib/table-catalog.ts';

test('bulk names accept newlines and commas, deduplicate, and preserve distinct schemas', () => {
  const tables = parseTableList('profiles\nclassrooms, public.profiles\narchive.profiles');
  assert.equal(tables.length, 3);
  assert.equal(new Set(tables.map(tableId)).size, 3);
  assert.deepEqual(tables.find(table => table.name === 'classrooms'), {
    schema: 'public', name: 'classrooms', primaryKey: [],
  });
});

test('SQL metadata imports composite keys in order without assuming an id column', () => {
  const imported = parseTableList(JSON.stringify([
    { schema: 'public', name: 'classroom_mission_settings', primaryKey: ['classroom_id', 'mission_id'] },
    { schema: 'public', name: 'profiles', primaryKey: ['user_id'], orderColumn: 'updated_at' },
  ]));
  assert.deepEqual(imported[0].primaryKey, ['classroom_id', 'mission_id']);
  assert.equal(imported[1].orderColumn, 'updated_at');
  const existing = parseTableList('classroom_mission_settings\nprofiles\nevents');
  const merged = mergeTables(existing, imported);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.find(table => table.name === 'profiles').primaryKey, ['user_id']);
});

test('invalid imports fail as a whole instead of partially replacing a catalog', () => {
  for (const input of ['', '[]', '[{"name":"profiles"}, {"name":"bad","primaryKey":12}]', '[null]', '["profiles",', 'public.']) {
    assert.throws(() => parseTableList(input));
  }
});

test('composite row identities survive data updates and row reordering', () => {
  const keys = ['classroom_id', 'mission_id'];
  const before = identifyRows([
    { classroom_id: 1, mission_id: 1, enabled: false },
    { classroom_id: 1, mission_id: 2, enabled: true },
  ], keys);
  const after = identifyRows([
    { classroom_id: 1, mission_id: 2, enabled: false },
    { classroom_id: 1, mission_id: 1, enabled: true },
  ], keys);
  assert.equal(before[0].key, after[1].key);
  assert.equal(before[1].key, after[0].key);
  assert.notEqual(before[0].key, before[1].key);
});

test('tables without id and even duplicate rows remain individually selectable', () => {
  const rows = [{ name: 'one', enabled: true }, { name: 'one', enabled: true }, { name: 'two', enabled: false }];
  const identified = identifyRows(rows, []);
  assert.equal(new Set(identified.map(row => row.key)).size, 3);
  assert.deepEqual(identified.map(row => row.data), rows);
  assert.equal(identifyRows([{ enabled: true, name: 'one' }], [])[0].key, identified[0].key);
});

test('live discovery preserves columns, access status and publication status, including an empty catalog', () => {
  assert.deepEqual(parseDatabaseCatalog([]), []);
  const [table] = parseDatabaseCatalog([{
    schema: 'public', name: 'empty_table', primaryKey: ['uuid'], columns: ['uuid', 'name'],
    canRead: false, realtimeEnabled: false, isPartitioned: true,
  }]);
  assert.deepEqual(table.columns, ['uuid', 'name']);
  assert.equal(table.canRead, false);
  assert.equal(table.realtimeEnabled, false);
  assert.equal(table.isPartitioned, true);
  assert.throws(() => parseDatabaseCatalog(null));
  assert.throws(() => parseDatabaseCatalog([{name:'bad',canRead:'false'}]));
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const refs = require('../site-references.js');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/site.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(raw));

test('homepage and introduction use the same live faculty records without overwriting tokens', () => {
  const data = clone();
  const before = JSON.stringify(data);
  const output = refs.resolve(data);
  assert.equal(output.metrics[0].value, String(data.faculty.length));
  assert.match(JSON.stringify(output.pages), new RegExp(`專任教師 ${data.faculty.length} 位`));
  assert.match(JSON.stringify(output.pages), /教授 3 位/);
  assert.equal(JSON.stringify(data), before);
});
test('adding, removing and promoting faculty updates every reference', () => {
  const data = clone();
  const initial = refs.values(data);
  data.faculty.push({ name: '測試教師', role: '助理教授' });
  assert.equal(refs.resolve(data).metrics[0].value, String(initial['stats.faculty.fullTime'] + 1));
  data.faculty.at(-1).role = '副教授兼主管';
  let counts = refs.values(data);
  assert.equal(counts['stats.faculty.associateProfessor'], initial['stats.faculty.associateProfessor'] + 1);
  assert.equal(counts['stats.faculty.assistantProfessor'], initial['stats.faculty.assistantProfessor']);
  data.faculty.pop();
  assert.deepEqual(refs.values(data), initial);
});
test('part-time and other appointments do not inflate full-time rank statistics', () => {
  const data = { faculty: [{ role: '教授', employmentType: 'partTime' }, { role: '副教授', employmentType: 'fullTime' }, { role: '專任教師' }] };
  const counts = refs.values(data);
  assert.equal(counts['stats.faculty.total'], 3);
  assert.equal(counts['stats.faculty.fullTime'], 2);
  assert.equal(counts['stats.faculty.professor'], 0);
  assert.equal(counts['stats.faculty.associateProfessor'], 1);
  assert.match(counts['stats.faculty.rankSummary'], /其他職稱教師 1 位/);
});
test('empty lists, reusable scalar facts and nested references resolve correctly', () => {
  const data = { faculty: [], facts: { label: '{{identity.title}}', zero: 0 }, identity: { title: '測試系' }, pages: [{ text: '{{facts.label}}：{{stats.faculty.total}} / {{facts.zero}}' }] };
  assert.equal(refs.resolve(data).pages[0].text, '測試系：0 / 0');
  assert.equal(refs.resolveText('114學年度、130學分、2023年第三名', data), '114學年度、130學分、2023年第三名');
});
test('missing and cyclic references fail with useful errors', () => {
  assert.throws(() => refs.resolve({ text: '{{stats.typo.total}}' }), /找不到引用/);
  assert.throws(() => refs.resolve({ text: '{{__proto__}}' }), /找不到引用/);
  assert.throws(() => refs.resolve({ facts: { a: '{{facts.b}}', b: '{{facts.a}}' } }), /循環引用/);
});
test('core-field names and counts share the home feature list', () => {
  const data = clone();
  data.homeFeatures.push({ title: '測試領域', text: '' });
  const output = refs.resolve(data);
  assert.match(output.metrics[1].label, /測試領域/);
  assert.match(output.pages.find(page => page.slug === 'development').summary, /4 大核心技術領域/);
});
test('every frontend entry loads shared resolver before the main script', () => {
  const root = path.join(__dirname, '..');
  for (const name of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    const main = text.indexOf('<script src="./script.js');
    if (main < 0) continue;
    const resolver = text.indexOf('<script src="./site-references.js');
    assert.ok(resolver >= 0 && resolver < main, name);
  }
});

/* Shared by the website, local CMS and static builder. Never changes source data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SiteReferences = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const collections = ['faculty', 'staff', 'labProfiles', 'homeFeatures', 'news', 'careerPaths', 'curriculumModules', 'studentResources', 'specialPrograms', 'campusLinks', 'awardSlides'];
  function values(data) {
    const result = Object.create(null);
    for (const key of collections) result[`stats.${key}.total`] = (data[key] || []).length;
    result['stats.homeFeatures.titles'] = (data.homeFeatures || []).map(item => item.title).filter(Boolean).join('、');
    // Existing records are full-time; the CMS can explicitly mark new part-time faculty.
    const fullTime = (data.faculty || []).filter(person => (person.employmentType || 'fullTime') === 'fullTime');
    result['stats.faculty.fullTime'] = fullTime.length;
    const ranks = { assistantProfessor: 0, associateProfessor: 0, professor: 0, lecturer: 0, other: 0 };
    for (const person of fullTime) {
      const role = person.role || '';
      const rank = /助理教授/.test(role) ? 'assistantProfessor' : /副教授/.test(role) ? 'associateProfessor' : /教授/.test(role) ? 'professor' : /講師/.test(role) ? 'lecturer' : 'other';
      ranks[rank]++;
    }
    const labels = { assistantProfessor: '助理教授', associateProfessor: '副教授', professor: '教授', lecturer: '講師', other: '其他職稱教師' };
    for (const [rank, count] of Object.entries(ranks)) result[`stats.faculty.${rank}`] = count;
    result['stats.faculty.rankSummary'] = Object.entries(ranks).filter(([, count]) => count).map(([rank, count]) => `${labels[rank]} ${count} 位`).join('、') || '目前無專任教師資料';
    for (const group of ['identity', 'contact', 'facts']) {
      for (const [key, value] of Object.entries(data[group] || {})) {
        if (['string', 'number', 'boolean'].includes(typeof value)) result[`${group}.${key}`] = value;
      }
    }
    return result;
  }
  function createResolver(data) {
    const source = values(data);
    function text(value, path = '文字', stack = []) {
      return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, rawKey) => {
        const key = rawKey.trim();
        if (!Object.prototype.hasOwnProperty.call(source, key)) throw new Error(`${path}：找不到引用 {{${key}}}`);
        if (stack.includes(key)) throw new Error(`${path}：循環引用 ${[...stack, key].join(' → ')}`);
        return text(String(source[key]), path, [...stack, key]);
      });
    }
    return text;
  }
  function resolve(data) {
    const text = createResolver(data);
    function visit(value, path) {
      if (typeof value === 'string') return text(value, path);
      if (Array.isArray(value)) return value.map((item, index) => visit(item, `${path}.${index}`));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, `${path}.${key}`)]));
      return value;
    }
    return visit(data, 'site');
  }
  return { values, resolve, resolveText: (text, data) => createResolver(data)(String(text)) };
});

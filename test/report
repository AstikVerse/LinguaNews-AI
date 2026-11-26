import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { countWords, highlightEvidence, HYBRIDS, parseReport } from '../src/report.js';

function sample(source) {
  return {
    source,
    comparison: {
      article_id: 'article-check',
      source_characters: Array.from(source).length,
      source_sha256: createHash('sha256').update(source).digest('hex'),
      variants: [{ name: HYBRIDS[0].key, summary: 'दिल्ली में १२ मिमी बारिश।', stages: [] }],
    },
  };
}

test('imports an actual envelope and supports standalone reports with pasted source', async () => {
  const data = sample('Rain 🌧️ fell.');
  assert.equal((await parseReport(data, '')).mode, 'import');
  assert.equal((await parseReport(data.comparison, data.source)).source, data.source);
});

test('rejects a same-length article with different evidence', async () => {
  const data = sample('Delhi saw 12 mm.');
  await assert.rejects(parseReport(data.comparison, 'Delhi saw 20 mm.'), /checksum does not match/);
});

test('rejects malformed reports before rendering', async () => {
  const data = sample('Delhi saw 12 mm.');
  data.comparison.variants[0].stages.push({ name: 'translate', output: {} });
  await assert.rejects(parseReport(data, ''), /comparison JSON/);
});

test('preserves Hindi combining marks and code-point offsets for highlighting', () => {
  assert.equal(countWords('दिल्ली में १२ मिमी बारिश।'), 5);
  assert.deepEqual(highlightEvidence({
    quote: '😀 12 mm rain', span: { start: 10, end: 22 },
    fact: { span: { start: 12, end: 17 } },
  }), ['😀 ', '12 mm', ' rain']);
});

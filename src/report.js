export const HYBRIDS = [
  {
    key: 'translate_then_summarize_hybrid',
    letter: 'A',
    name: 'Translate first',
    flow: ['Translate', 'TextRank', 'Abstract'],
  },
  {
    key: 'summarize_then_translate_hybrid',
    letter: 'B',
    name: 'Summarize first',
    flow: ['TextRank', 'Abstract', 'Translate'],
  },
];

export const countWords = (text) => text.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d]*/gu)?.length ?? 0;
export const statusLabel = {
  supported: 'Supported',
  contradicted: 'Contradicted',
  insufficient_evidence: 'Insufficient evidence',
  ambiguous: 'Ambiguous',
};

export const findingsOf = (variant) => variant?.verification?.findings ?? [];
export const isWarning = (finding) => finding.status !== 'supported';
export const seconds = (value) => (Number.isFinite(value) ? `${value.toFixed(2)} s` : '—');

export function highlightEvidence(evidence) {
  const quote = evidence.quote ?? '';
  if (!evidence.fact?.span || !evidence.span) return [quote, '', ''];
  const text = Array.from(quote);
  const start = evidence.fact.span.start - evidence.span.start;
  const end = evidence.fact.span.end - evidence.span.start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= end || end > text.length) {
    return [quote, '', ''];
  }
  return [text.slice(0, start).join(''), text.slice(start, end).join(''), text.slice(end).join('')];
}

function validVariant(variant) {
  return variant && typeof variant.name === 'string'
    && (typeof variant.summary === 'string' || variant.summary === null)
    && Array.isArray(variant.stages)
    && variant.stages.every((step) => step && typeof step.name === 'string'
      && (step.output === null || typeof step.output === 'string'))
    && (!variant.verification || (
      Array.isArray(variant.verification.findings)
      && variant.verification.findings.every((finding) => finding && Object.hasOwn(statusLabel, finding.status)
        && typeof finding.summary_quote === 'string' && Array.isArray(finding.evidence)
        && finding.evidence.every((item) => item && typeof item.quote === 'string'))
      && Array.isArray(variant.verification.source_coverage)
      && variant.verification.source_coverage.every((fact) => fact && typeof fact.source_quote === 'string'
        && typeof fact.status === 'string')
    ));
}

export async function parseReport(json, editorText) {
  const comparison = json?.comparison ?? json;
  const source = json?.source ?? editorText;
  if (!comparison || typeof comparison.article_id !== 'string' || !Array.isArray(comparison.variants)
    || !comparison.variants.every(validVariant)
    || new Set(comparison.variants.map((variant) => variant.name)).size !== comparison.variants.length
    || !HYBRIDS.some((item) => comparison.variants.some((variant) => variant.name === item.key))) {
    throw new Error('Choose a LinguaNews comparison JSON with at least one hybrid pipeline.');
  }
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error('Paste the original article before opening this report.');
  }
  if (comparison.source_characters !== Array.from(source).length) {
    throw new Error('The source text does not match this report. Paste the original article exactly.');
  }
  if (comparison.source_sha256) {
    if (!globalThis.crypto?.subtle) throw new Error('Source verification requires HTTPS or localhost.');
    const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (digest !== comparison.source_sha256) {
      throw new Error('The source checksum does not match. Paste the original article exactly.');
    }
  }
  return { comparison, source, mode: json?.mode === 'demo' ? 'demo' : 'import' };
}

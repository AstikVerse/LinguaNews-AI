import React, { Fragment, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, BookOpen, ChevronDown, CircleAlert, CircleCheck, Download, FileText,
  GitCompareArrows, Languages, ListTree, Play, Search, Upload,
} from 'lucide-react';
import '@fontsource-variable/inter';
import '@fontsource/noto-sans-devanagari/devanagari-400.css';
import '@fontsource/noto-sans-devanagari/devanagari-600.css';
import './styles.css';
import examples from './examples.json';
import {
  HYBRIDS, countWords, findingsOf, highlightEvidence, isWarning, parseReport, seconds, statusLabel,
} from './report.js';

const TABS = [
  { id: 'summaries', label: 'Summaries', icon: FileText },
  { id: 'facts', label: 'Fact checks', icon: Search },
  { id: 'stages', label: 'Stages', icon: ListTree },
];
const STAGE_NAMES = { translate: 'Translation', extract: 'TextRank extraction', abstract: 'Abstractive summary', lead: 'Lead selection' };
const LANGUAGE_NAMES = { en: 'English', hi: 'Hindi' };

function sampleReport(sample) {
  return { mode: 'demo', source: sample.source, comparison: sample.comparison };
}

function PipelineHeading({ pipeline }) {
  return (
    <>
      <div className="pipeline-heading">
        <div className="pipeline-code" aria-label={`Pipeline ${pipeline.letter}`}>{pipeline.letter}</div>
        <div>
          <h3>{pipeline.name}</h3>
          <div className="pipeline-flow" aria-label={pipeline.flow.join(', then ')}>
            {pipeline.flow.map((step, index) => (
              <Fragment key={step}>
                {index > 0 && <ArrowRight size={11} aria-hidden="true" />}
                <span>{step}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ReportCard({ pipeline, variant, mode, onFacts }) {
  const findings = findingsOf(variant);
  const warnings = findings.filter(isWarning).length;
  return (
    <article className={`result-card pipeline-${pipeline.letter.toLowerCase()}`}>
      <PipelineHeading pipeline={pipeline} />
      <div className="summary-area">
        <div className="summary-label">
          <span>Hindi summary</span><span lang="hi">हिन्दी</span>
        </div>
        {variant?.summary ? (
          <p lang="hi" className="hindi-text">{variant.summary}</p>
        ) : (
          <p className="muted">{variant?.failed_stage
            ? `Stopped at ${STAGE_NAMES[variant.failed_stage] ?? variant.failed_stage}.`
            : 'This report has no summary for this pipeline.'}</p>
        )}
      </div>
      {variant?.summary && (
        <>
          <dl className="card-stats">
            <div><dt>Length</dt><dd>{countWords(variant.summary)} words</dd></div>
            <div><dt>Processing time</dt><dd>{mode === 'demo' ? 'Sample only' : seconds(variant.elapsed_seconds)}</dd></div>
          </dl>
          <button
            className={`evidence-button ${warnings ? 'has-warning' : ''}`}
            onClick={onFacts}
            type="button"
          >
            {warnings ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
            <span>{variant.verification
              ? (warnings ? `${warnings} ${warnings === 1 ? 'finding needs' : 'findings need'} review` : 'No flagged findings')
              : 'Verification unavailable'}</span>
            <ChevronDown size={15} className="evidence-chevron" />
          </button>
        </>
      )}
    </article>
  );
}

function FactCard({ pipeline, variant, onlyWarnings }) {
  const findings = findingsOf(variant);
  const visible = onlyWarnings ? findings.filter(isWarning) : findings;
  const coverage = variant?.verification?.source_coverage ?? [];
  return (
    <article className={`result-card pipeline-${pipeline.letter.toLowerCase()}`}>
      <PipelineHeading pipeline={pipeline} />
      <div className="subpanel fact-list">
        {!variant?.verification && <p className="muted">Verification is unavailable in this report.</p>}
        {variant?.verification && visible.length === 0 && (
          <p className="muted">{onlyWarnings && findings.length
            ? 'No findings need review in this pipeline.'
            : 'The verifier found no checkable claims in this view.'}</p>
        )}
        {visible.map((finding, index) => (
          <details key={`${finding.summary_quote}-${index}`} className="finding" open={visible.length === 1 ? true : undefined}>
            <summary>
              <span className="finding-quote" lang="hi">{finding.summary_quote}</span>
              <span className={`status-badge status-${finding.status}`}>{statusLabel[finding.status]}</span>
            </summary>
            <div className="finding-body">
              {finding.evidence.length ? finding.evidence.map((item, evidenceIndex) => {
                const [before, highlighted, after] = highlightEvidence(item);
                return (
                  <div className="source-evidence" key={evidenceIndex}>
                    <span>{item.role === 'related_context' ? 'Related source context' : 'Source evidence'}</span>
                    <blockquote>{before}{highlighted && <mark>{highlighted}</mark>}{after}</blockquote>
                  </div>
                );
              }) : <p className="muted">No matching source passage was found.</p>}
            </div>
          </details>
        ))}
        {coverage.length > 0 && (
          <details className="coverage">
            <summary>Source coverage <span>{coverage.length} facts</span></summary>
            <ul>
              {coverage.map((fact, index) => (
                <li key={index}><span>{fact.source_quote}</span><span>{
                  ({ aligned: 'Aligned', compared_with_warning: 'Check value', not_detected: 'Not detected' })[fact.status] ?? 'Unclassified'
                }</span></li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}

function StageCard({ pipeline, variant }) {
  return (
    <article className={`result-card pipeline-${pipeline.letter.toLowerCase()}`}>
      <PipelineHeading pipeline={pipeline} />
      <div className="subpanel">
        {!(variant?.stages.length) && <p className="muted">This report has no intermediate steps.</p>}
        {variant?.stages.map((stage, index) => (
          <details className="finding stage" key={`${stage.name}-${index}`}>
            <summary>
              <span>{STAGE_NAMES[stage.name] ?? stage.name}</span>
              <span className="muted">{stage.failure ? 'Failed' : LANGUAGE_NAMES[stage.output_language] ?? 'Output'}</span>
            </summary>
            <div className="finding-body">
              {stage.failure && <p className="muted">The pipeline stopped at this step.</p>}
              {stage.output && <p className={stage.output_language === 'hi' ? 'hindi-text' : ''} lang={stage.output_language}>{stage.output}</p>}
              {Number.isFinite(stage.elapsed_seconds) && <p className="muted">Processing time {seconds(stage.elapsed_seconds)}</p>}
            </div>
          </details>
        ))}
        {Number.isFinite(variant?.verification_elapsed_seconds) && (
          <p className="muted stage-time">Fact checks {seconds(variant.verification_elapsed_seconds)}</p>
        )}
      </div>
    </article>
  );
}

function App() {
  const [article, setArticle] = useState(examples[0].source);
  const [report, setReport] = useState(sampleReport(examples[0]));
  const [tab, setTab] = useState('summaries');
  const [onlyWarnings, setOnlyWarnings] = useState(true);
  const [runtime, setRuntime] = useState({ live_ready: false, mode: 'demo' });
  const [budget, setBudget] = useState(512);
  const [baselines, setBaselines] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [notice, setNotice] = useState('');
  const importInput = useRef(null);
  const selected = examples.find((item) => item.source === article);
  const words = countWords(article);
  const launchButton = runtime.live_ready ? 'Run comparison' : 'Run example';

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/status.json', { signal: controller.signal, cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((status) => { if (status && typeof status.live_ready === 'boolean') setRuntime(status); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function loadExample(id) {
    const sample = examples.find((item) => item.id === id);
    if (!sample) return;
    setArticle(sample.source);
    setReport(sampleReport(sample));
    setNotice('');
    setTab('summaries');
  }

  async function run(event) {
    event.preventDefault();
    setNotice('');
    if (!article.trim()) {
      setNotice('Enter an English article or choose an example.');
      return;
    }
    if (!runtime.live_ready) {
      if (selected) {
        setReport(sampleReport(selected));
        setTab('summaries');
      } else {
        setNotice('Choose an example or open a saved report for this article. Live comparison needs both models in the local app.');
      }
      return;
    }
    setInFlight(true);
    setReport(null);
    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article, budget, include_baselines: baselines }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Check the article and run settings.');
      const checked = await parseReport(result, article);
      setReport({ ...checked, mode: 'live' });
      setTab('summaries');
    } catch (error) {
      setNotice(error.message || 'The comparison could not start.');
    } finally {
      setInFlight(false);
    }
  }

  async function importReport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setInFlight(true);
    setNotice('');
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('Choose a report smaller than 12 MB.');
      const imported = await parseReport(JSON.parse(await file.text()), article);
      if (Array.from(imported.source).length > 30000) throw new Error('Choose an article with at most 30,000 characters.');
      setArticle(imported.source);
      setReport(imported);
      setTab('summaries');
    } catch (error) {
      setNotice(error instanceof SyntaxError ? 'This file does not contain valid JSON.' : error.message);
    } finally {
      setInFlight(false);
    }
  }

  function downloadReport() {
    const data = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report.comparison.article_id.replace(/[^a-z0-9-]/gi, '_')}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function tabKey(event, index) {
    const steps = { ArrowLeft: -1, ArrowRight: 1, Home: -index, End: TABS.length - index - 1 };
    if (!Object.hasOwn(steps, event.key)) return;
    event.preventDefault();
    const next = (index + steps[event.key] + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    event.currentTarget.parentElement.children[next].focus();
  }

  const otherVariants = report?.comparison.variants.filter((variant) => !HYBRIDS.some((item) => item.key === variant.name)) ?? [];
  return (
    <>
      <header className="topbar">
        <div className="page-width nav-content">
          <a href="#comparison" className="brand" aria-label="LinguaNews AI home">
            <span className="brand-icon"><Languages size={21} strokeWidth={2.1} aria-hidden="true" /></span>
            <span>LinguaNews<span className="brand-ai"> AI</span></span>
          </a>
          <nav aria-label="Main navigation">
            <a className="current" href="#comparison"><GitCompareArrows size={16} /> Compare</a>
            <a href="#workflow"><BookOpen size={16} /> Method</a>
          </nav>
          <div className={`runtime-tag ${runtime.live_ready ? 'runtime-live' : ''}`}>
            <span aria-hidden="true" />{runtime.live_ready ? 'Live runtime' : 'Presentation demo'}
          </div>
        </div>
      </header>

      <main id="comparison" className="page-width">
        <div className="introduction">
          <div>
            <div className="language-pair"><Languages size={15} /> <span>English to Hindi</span></div>
            <h1>Compare pipelines</h1>
            <p>Compare how two processing orders summarize the same English news article in Hindi.</p>
          </div>
        </div>

        <div className="workbench-grid">
          <form className="workspace-panel source-panel" onSubmit={run}>
            <div className="panel-heading"><FileText size={19} /><h2>Source article</h2></div>
            <label htmlFor="example">Example article</label>
            <div className="select-wrap">
              <select id="example" disabled={inFlight} value={selected?.id ?? ''} onChange={(event) => loadExample(event.target.value)}>
                <option value="" disabled>Choose an example</option>
                {examples.map((sample) => <option key={sample.id} value={sample.id}>{sample.title}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>

            <label className="article-label" htmlFor="article">
              <span>English text</span><span>{words.toLocaleString()} words</span>
            </label>
            <textarea
              id="article" placeholder="Paste an English news article…" required maxLength={30000} disabled={inFlight}
              value={article}
              onChange={(event) => { setArticle(event.target.value); setReport(null); setNotice(''); }}
            />
            {runtime.live_ready && (
              <details className="run-settings">
                <summary>Run settings</summary>
                <label htmlFor="budget">Input budget (tokens)</label>
                <input id="budget" type="number" min="1" max="512" required value={budget}
                  disabled={inFlight} onChange={(event) => setBudget(event.target.valueAsNumber || '')} />
                <label className="check-label"><input type="checkbox" checked={baselines}
                  disabled={inFlight} onChange={(event) => setBaselines(event.target.checked)} /> Include four baselines</label>
              </details>
            )}

            <div className="source-actions">
              <button className="button primary" type="submit" disabled={inFlight}>
                <Play size={16} aria-hidden="true" /> {inFlight ? 'Working…' : launchButton}
              </button>
              <button className="button text-button" type="button" disabled={inFlight || !article}
                onClick={() => { setArticle(''); setReport(null); setNotice(''); }}>Clear</button>
            </div>
            {notice && <p className="notice" role="alert"><CircleAlert size={16} />{notice}</p>}
            <p className="source-note">{runtime.live_ready
              ? 'Processing runs in this app’s Python runtime.'
              : 'Examples are authored. Open a saved report to review another article.'}</p>
          </form>

          <section className="result-panel" aria-busy={inFlight}>
            <div className="results-header">
              <div className="panel-heading"><GitCompareArrows size={20} /><h2>Pipeline results</h2></div>
              <div className="report-actions">
                <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={importReport} />
                <button type="button" className="button secondary" disabled={inFlight}
                  onClick={() => importInput.current?.click()}><Upload size={15} /> Open report</button>
                <button type="button" className="button secondary icon-button" title="Download report"
                  aria-label="Download report" disabled={!report || inFlight} onClick={downloadReport}><Download size={17} /></button>
              </div>
            </div>
            <div className="tabs" role="tablist" aria-label="Report view">
              {TABS.map(({ id, label, icon: Icon }, index) => (
                <button role="tab" type="button" id={`tab-${id}`} aria-controls="results-tab"
                  className={tab === id ? 'active' : ''} aria-selected={tab === id}
                  tabIndex={tab === id ? 0 : -1} key={id}
                  onClick={() => setTab(id)} onKeyDown={(event) => tabKey(event, index)}>
                  <Icon size={16} /><span>{label}</span>
                </button>
              ))}
            </div>
            <div role="tabpanel" id="results-tab" aria-labelledby={`tab-${tab}`}>
              {!report ? (
                <div className="empty-panel" role="status">
                  {inFlight ? <span className="spinner" aria-hidden="true" /> : <GitCompareArrows size={30} />}
                  <h3>{inFlight ? 'Working on your report' : 'Results will appear here'}</h3>
                  <p>{inFlight ? 'Each pipeline runs independently on the same article.' : 'Choose an example, run a live comparison, or open a report.'}</p>
                </div>
              ) : (
                <>
                  <div className="view-options">
                    <span className="mode-label">{report.mode === 'demo' ? 'Authored example' : report.mode === 'live' ? 'Live comparison' : 'Imported report'}</span>
                    {tab === 'facts' && (
                      <label className="check-label"><input type="checkbox" checked={onlyWarnings}
                        onChange={(event) => setOnlyWarnings(event.target.checked)} /> Warnings only</label>
                    )}
                    {tab === 'summaries' && <span className="muted">{report.comparison.source_sha256
                      ? 'Same source article' : 'Source length checked'}</span>}
                    {tab === 'stages' && <span className="muted">Expand a step to inspect its output</span>}
                  </div>
                  <div className="cards-grid">
                    {HYBRIDS.map((pipeline) => {
                      const variant = report.comparison.variants.find((item) => item.name === pipeline.key);
                      if (tab === 'facts') return <FactCard key={pipeline.key} {...{ pipeline, variant, onlyWarnings }} />;
                      if (tab === 'stages') return <StageCard key={pipeline.key} {...{ pipeline, variant }} />;
                      return <ReportCard key={pipeline.key} {...{ pipeline, variant }} mode={report.mode}
                        onFacts={() => {
                          setOnlyWarnings(true);
                          setTab('facts');
                          requestAnimationFrame(() => document.getElementById('tab-facts')?.focus());
                        }} />;
                    })}
                  </div>
                  {otherVariants.length > 0 && (
                    <details className="baseline-panel">
                      <summary>Additional baselines <span>{otherVariants.length}</span></summary>
                      {otherVariants.map((variant) => (
                        <div key={variant.name}>
                          <h3>{variant.name.replaceAll('_', ' ')}</h3>
                          <p lang="hi">{variant.summary ?? `Stopped at ${STAGE_NAMES[variant.failed_stage] ?? 'an unknown stage'}.`}</p>
                          <span className="muted">{seconds(variant.elapsed_seconds)}</span>
                        </div>
                      ))}
                    </details>
                  )}
                </>
              )}
            </div>
          </section>
        </div>

        <section id="workflow" className="workspace-panel workflow">
          <div className="panel-heading"><BookOpen size={19} /><h2>How to read this comparison</h2></div>
          <div className="workflow-grid">
            <div><h3>Translate first</h3><p>Translate the complete article, select relevant Hindi sentences, then summarize them.</p></div>
            <div><h3>Summarize first</h3><p>Select and summarize English sentences, then translate the resulting summary.</p></div>
            <div><h3>Check the source</h3><p>Review flagged claims against the original article. Missing details appear separately under source coverage.</p></div>
          </div>
        </section>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);

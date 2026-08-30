import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '../../api'
import { Notice, Spinner, errText } from '../../components/ui'
import { useDealerships, VOICE_NAMES } from '../../components/shared'

// YYYY-MM-DD for `n` days ago (used for the quick presets + date input default).
function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

// Estimated per-call_type pricing. Token-based rows use $/1M-token rates;
// per-request rows (no tokens) use a flat $/row. Keep these in sync with the
// providers' pricing pages.
//   Gemini 3.5 Flash-Lite: $0.10/1M in, $0.40/1M out
//   Claude Sonnet 4.6:     $3/1M in, $15/1M out
//   ElevenLabs voice_tts:  $0.0243 per request
//   Shotstack video_render: 0.7 credits × $0.195 = $0.1365 per render
const RATES = {
  photo_classification:    { kind: 'tokens', in: 0.10, out: 0.40 },
  video_script_generation: { kind: 'tokens', in: 3,    out: 15   },
  marketplace_caption:     { kind: 'tokens', in: 3,    out: 15   },
  fb_post_caption:         { kind: 'tokens', in: 3,    out: 15   },
  tagline_translation:     { kind: 'tokens', in: 3,    out: 15   },
  script_preview:          { kind: 'tokens', in: 3,    out: 15   },
  voice_tts:               { kind: 'perRow', usd: 0.0243 },
  video_render:            { kind: 'perRow', usd: 0.1365 },
}

const RATES_TOOLTIP =
  'Estimated rates:\n' +
  '• photo_classification — Gemini 3.5 Flash-Lite: $0.10/1M in, $0.40/1M out\n' +
  '• script/caption/tagline — Claude Sonnet 4.6: $3/1M in, $15/1M out\n' +
  '• voice_tts — ElevenLabs: $0.0243 / request\n' +
  '• video_render — Shotstack: $0.1365 / render (0.7 cr × $0.195)\n' +
  'Token-based types use real logged tokens; per-request types use row count.'

// Cost of one costs-row given its call_type. Returns null when we have no rate
// for that call_type (so the UI can show "—" instead of a misleading $0).
function costOf(callType, { input_tokens = 0, output_tokens = 0, rows = 0 } = {}) {
  const r = RATES[callType]
  if (!r) return null
  if (r.kind === 'tokens') return input_tokens / 1e6 * r.in + output_tokens / 1e6 * r.out
  if (r.kind === 'perRow')  return rows * r.usd
  return null
}

function usd(n) {
  if (n == null) return '—'
  if (n === 0) return '$0.00'
  if (n < 0.01) return `$${n.toFixed(4)}`   // sub-cent: show more precision
  return `$${n.toFixed(2)}`
}

export default function Analytics() {
  const { dealerships } = useDealerships()
  const [since, setSince] = useState(daysAgoISO(7))
  const [dealershipId, setDealershipId] = useState('')
  const [overview, setOverview] = useState(null)
  const [costs, setCosts] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  // Every fetch goes to the server with the current since/dealership params —
  // there is no client-side re-filtering of a stale cache.
  const load = useCallback(async (sinceVal, dealer) => {
    setLoading(true); setErr(null)
    const params = { since: sinceVal }
    if (dealer) params.dealership_id = dealer
    try {
      const [o, c] = await Promise.all([
        adminApi.analyticsOverview(params),
        adminApi.analyticsCosts(params),
      ])
      setOverview(o); setCosts(c)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(since, dealershipId) }, [since, dealershipId, load])

  const sr = overview?.success_rate
  const pct = sr?.ratio != null ? Math.round(sr.ratio * 100) : null

  return (
    <div className="stack">
      {/* ── Controls ── */}
      <div className="card card-pad">
        <div className="row-between">
          <div className="row">
            <div>
              <span className="muted" style={{ fontSize: 12, marginRight: 8 }}>Since</span>
              <input className="input" type="date" style={{ width: 160, display: 'inline-block' }}
                value={since} onChange={(e) => setSince(e.target.value)} />
            </div>
            <div className="row" style={{ gap: 4 }}>
              {PRESETS.map((p) => (
                <button key={p.days} className={`btn btn-sm ${since === daysAgoISO(p.days) ? 'btn-navy' : 'btn-ghost'}`}
                  onClick={() => setSince(daysAgoISO(p.days))}>{p.label}</button>
              ))}
            </div>
          </div>
          <div style={{ width: 240 }}>
            <select className="select" value={dealershipId} onChange={(e) => setDealershipId(e.target.value)}>
              <option value="">All dealerships</option>
              {dealerships.map((d) => <option key={d.id} value={d.id}>{d.dealership_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Notice kind="error">{err}</Notice>

      {loading && <Spinner />}

      {!loading && overview && (
        <>
          {/* ── Overview ── */}
          <div className="grid-3">
            <div className="stat">
              <div className="k">Active Users</div>
              <div className="v">{overview.active_users}</div>
              <div className="sub">distinct users with activity</div>
            </div>
            <div className="stat">
              <div className="k">Success Rate</div>
              <div className="v">{pct != null ? `${pct}%` : '—'}</div>
              <div className="sub">{sr?.generated ?? 0} generated · {sr?.failed ?? 0} failed</div>
            </div>
            <div className="stat">
              <div className="k">Generations</div>
              <div className="v">{sr?.total ?? 0}</div>
              <div className="sub">generated + failed</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card card-pad">
              <h2 className="section-title">Format Split</h2>
              <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>generated events by video format</p>
              <BarList data={Object.entries(overview.format_split || {}).map(([k, v]) => ({ label: k, value: v }))} />
            </div>

            <div className="card card-pad">
              <h2 className="section-title">Top Voices</h2>
              <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>most-used voices (generated)</p>
              {(!overview.top_voices || overview.top_voices.length === 0) && <div className="empty">No voice data.</div>}
              {overview.top_voices?.length > 0 && (
                <table>
                  <thead><tr><th>Voice</th><th>Type</th><th style={{ textAlign: 'right' }}>Uses</th></tr></thead>
                  <tbody>
                    {overview.top_voices.map((v) => (
                      <tr key={v.voice_id}>
                        <td>
                          <span>{VOICE_NAMES[v.voice_id] || <span className="mono">{v.voice_id}</span>}</span>
                        </td>
                        <td>
                          <span className={`badge ${v.type === 'preloaded' ? 'badge-blue' : 'badge-amber'}`}>{v.type}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{v.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Costs ── */}
      {!loading && costs && (
        <div className="card card-pad">
          <div className="row-between">
            <h2 className="section-title">API Usage / Costs</h2>
          </div>
          <Notice kind="info">
            Cost is an <strong>estimate</strong>, computed here from logged tokens (LLM/Gemini) and request counts (voice/render) — hover <strong>Cost (est.)</strong> for the rates. Backend returns raw sums only.
          </Notice>

          <table>
            <thead>
              <tr>
                <th>Call Type</th>
                <th style={{ textAlign: 'right' }}>Quantity</th>
                <th style={{ textAlign: 'right' }}>Input Tokens</th>
                <th style={{ textAlign: 'right' }}>Output Tokens</th>
                <th style={{ textAlign: 'right' }}>Rows</th>
                <th style={{ textAlign: 'right' }} title={RATES_TOOLTIP}>Cost (est.) ⓘ</th>
              </tr>
            </thead>
            <tbody>
              {costs.by_call_type.map((r) => (
                <tr key={r.call_type}>
                  <td>{r.call_type}</td>
                  <td style={{ textAlign: 'right' }}>{r.quantity?.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }} className="muted">{r.input_tokens?.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }} className="muted">{r.output_tokens?.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }} className="muted">{r.rows?.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{usd(costOf(r.call_type, r))}</td>
                </tr>
              ))}
              {costs.by_call_type.length === 0 && (
                <tr><td colSpan={6}><div className="empty">No API usage in this window.</div></td></tr>
              )}

              {/* Unattributed bucket — user_id IS NULL. Surfaced separately, never folded into the total silently.
                  Its relationship to `total` differs by mode:
                   - no dealership filter: the call-type rows already include NULL-user rows, so this is a
                     SUBSET already counted in Total.
                   - dealership filter on: the call-type rows + Total are scoped to that dealership's users,
                     so this platform-wide bucket is NOT part of Total. */}
              <tr style={{ background: '#fffbf2' }}>
                <td>
                  <strong>Unattributed</strong>
                  <div className="muted" style={{ fontSize: 11 }}>
                    user_id is null · {dealershipId
                      ? 'platform-wide — NOT included in this dealership’s total'
                      : 'subset already counted in the call-type rows & total'}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>{costs.unattributed.quantity?.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }} className="muted">{costs.unattributed.input_tokens?.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }} className="muted">{costs.unattributed.output_tokens?.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }} className="muted">{costs.unattributed.rows?.toLocaleString()}</td>
                {/* no per-type breakdown for the null-user bucket, so cost can't be split by rate */}
                <td style={{ textAlign: 'right' }} className="muted" title="Mixed call types (user_id null) — can't price per rate here; it's already counted in the call-type rows above (unfiltered) or excluded from a dealership total (filtered).">—</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td><strong>Total</strong> <span className="muted" style={{ fontSize: 11 }}>
                  {dealershipId ? '(this dealership’s users only)' : '(everything in window, incl. unattributed)'}
                </span></td>
                <td style={{ textAlign: 'right' }}><strong>{costs.total.quantity?.toLocaleString()}</strong></td>
                <td style={{ textAlign: 'right' }}><strong>{costs.total.input_tokens?.toLocaleString()}</strong></td>
                <td style={{ textAlign: 'right' }}><strong>{costs.total.output_tokens?.toLocaleString()}</strong></td>
                <td style={{ textAlign: 'right' }}><strong>{costs.total.rows?.toLocaleString()}</strong></td>
                <td style={{ textAlign: 'right' }}><strong>
                  {usd(costs.by_call_type.reduce((s, r) => s + (costOf(r.call_type, r) || 0), 0))}
                </strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// Simple horizontal bar list (no chart library — matches the lightweight preference).
function BarList({ data }) {
  if (!data || data.length === 0) return <div className="empty">No data.</div>
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="stack" style={{ gap: 10 }}>
      {data.map((d) => (
        <div key={d.label}>
          <div className="row-between" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 13 }}>{d.label}</span>
            <span className="muted" style={{ fontSize: 13 }}>{d.value}</span>
          </div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(d.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Notice, Spinner, errText, fmtDate } from './ui'
import { voiceLabel } from './shared'

// Shared per-salesperson detail view, rendered by BOTH the manager drill-down
// (/manager/team/:id) and the admin user detail (/admin/users/:id). `fetcher`
// is the endpoint call — (params) => Promise<data> — so the same UI is backed by
// whichever endpoint the caller passes; the data shape is identical (both hit
// the get_user_activity service).
//
// The top-line Generated/Posted tiles are all-time activity. The time-range
// control filters only the VEHICLE list (cars posted in the window, by
// fb_posted_at) — that's the "how many cars posted in a range" the manager asked
// for. The vehicle list is scrollable so a long inventory doesn't congest.
export default function SalespersonDetail({ fetcher, backTo, backLabel }) {
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (s, u) => {
    setLoading(true); setErr(null)
    try {
      const params = {}
      if (s) params.since = s
      if (u) params.until = u
      setData(await fetcher(params))
    } catch (e) {
      setErr(errText(e))
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => { load(since, until) }, [since, until, load])

  const ranged = Boolean(since || until)
  const vehicles = data?.vehicles || []

  return (
    <div className="stack">
      <div><Link to={backTo} className="muted">← {backLabel}</Link></div>

      <Notice kind="error">{err}</Notice>
      {!data && !err && <Spinner />}

      {data && (
        <>
          <div className="card card-pad">
            <h2 className="section-title" style={{ marginBottom: 2 }}>{data.full_name || '—'}</h2>
            <div className="muted mono">{data.email}</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              <span className="badge">{data.role}</span>
              <span style={{ marginLeft: 8 }}>Last active {data.last_active ? fmtDate(data.last_active) : '—'}</span>
            </div>
          </div>

          <div className="grid-2">
            <div className="stat">
              <div className="k">Generated</div>
              <div className="v">{data.generated}</div>
              <div className="sub">ads generated (all-time)</div>
            </div>
            <div className="stat">
              <div className="k">Posted</div>
              <div className="v">{data.posted}</div>
              <div className="sub">
                {data.posted_by_channel
                  ? `🛒 ${data.posted_by_channel.marketplace} · 📘 ${data.posted_by_channel.fb_post} · 👥 ${data.posted_by_channel.fb_groups} · 🎬 ${data.posted_by_channel.fb_reel || 0}`
                  : 'marketplace + FB post + groups + reels (all-time)'}
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="row-between" style={{ marginBottom: 6 }}>
              <div>
                <h2 className="section-title mb-0">Vehicles</h2>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
                  {ranged
                    ? `${data.vehicles_posted} car${data.vehicles_posted === 1 ? '' : 's'} posted in range`
                    : `${vehicles.length} car${vehicles.length === 1 ? '' : 's'} · ${data.vehicles_posted} posted`}
                </p>
              </div>
              <RangeControls
                since={since} until={until}
                onSince={setSince} onUntil={setUntil}
                onClear={() => { setSince(''); setUntil('') }}
                ranged={ranged}
              />
            </div>

            {loading && <div style={{ padding: 8 }}><Spinner /></div>}
            {!loading && vehicles.length === 0 && (
              <div className="empty">{ranged ? 'No cars posted in this range.' : 'No saved vehicles yet.'}</div>
            )}
            {!loading && vehicles.length > 0 && (
              <div className="scroll-list">
                {vehicles.map((v) => (
                  <div key={v.listing_id} className="card list-row">
                    <strong>{[v.year, v.make, v.model].filter(Boolean).join(' ') || '—'}</strong>
                    <span className="row" style={{ gap: 8 }}>
                      {v.posted_at && <span className="muted" style={{ fontSize: 12 }}>{fmtDate(v.posted_at)}</span>}
                      <span className="mono muted">{formatPrice(v.price)}</span>
                      <ChannelBadges channels={v.channels} posted={v.posted} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <h2 className="section-title">Favorites</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
              most-used theme / format / voice across this person's generated ads
            </p>
            <div className="kv">
              <span className="muted">Favorite theme</span>
              <span>{data.favorite_theme || <span className="muted">—</span>}</span>
            </div>
            <div className="kv">
              <span className="muted">Favorite format</span>
              <span>{data.favorite_format || <span className="muted">—</span>}</span>
            </div>
            <div className="kv">
              <span className="muted">Favorite voice</span>
              <span>{data.favorite_voice ? voiceLabel(data.favorite_voice) : <span className="muted">—</span>}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Per-vehicle channel indicator, sourced from posting events (channels = counts
// per channel for THIS car). One badge per channel it was posted to, so a car
// posted to all three shows Marketplace + Post + Groups — not a single "Posted".
// Falls back to the binary posted flag when there are no linked posting events
// (e.g. posts made before channel-linking shipped).
const CHANNEL_META = [
  { key: 'marketplace', label: '🛒 Marketplace' },
  { key: 'fb_post', label: '📘 Post' },
  { key: 'fb_groups', label: '👥 Groups' },
  { key: 'fb_reel', label: '🎬 Reel' },
]
function ChannelBadges({ channels, posted }) {
  const active = CHANNEL_META.filter((c) => (channels?.[c.key] || 0) > 0)
  if (active.length === 0) {
    return posted
      ? <span className="badge badge-blue">Posted</span>
      : <span className="badge">Not posted</span>
  }
  return (
    <span className="row" style={{ gap: 4 }}>
      {active.map((c) => (
        <span key={c.key} className="badge badge-blue">
          {c.label}{channels[c.key] > 1 ? ` ×${channels[c.key]}` : ''}
        </span>
      ))}
    </span>
  )
}

function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const PRESETS = [7, 30, 90]

function RangeControls({ since, until, onSince, onUntil, onClear, ranged }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {PRESETS.map((n) => (
        <button key={n}
          className={`btn btn-sm ${since === daysAgoISO(n) && !until ? 'btn-navy' : 'btn-ghost'}`}
          onClick={() => { onSince(daysAgoISO(n)); onUntil('') }}>
          {n}d
        </button>
      ))}
      <input className="input" type="date" style={{ width: 140 }} value={since}
        onChange={(e) => onSince(e.target.value)} aria-label="Posted since" />
      <span className="muted" style={{ fontSize: 12 }}>→</span>
      <input className="input" type="date" style={{ width: 140 }} value={until}
        onChange={(e) => onUntil(e.target.value)} aria-label="Posted until" />
      {ranged && <button className="btn btn-ghost btn-sm" onClick={onClear}>All time</button>}
    </div>
  )
}

// price is a free-text string on Listing (e.g. "28995"); show it with a $ + thousands.
function formatPrice(price) {
  if (price == null || price === '') return '—'
  const digits = String(price).replace(/[^\d.]/g, '')
  if (!digits) return String(price)
  const n = Number(digits)
  return isNaN(n) ? String(price) : `$${n.toLocaleString()}`
}

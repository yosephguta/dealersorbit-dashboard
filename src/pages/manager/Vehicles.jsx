import { useEffect, useState } from 'react'
import { managerApi } from '../../api'
import { Notice, Spinner, errText } from '../../components/ui'

// STEP 4 — Vehicles the dealership has posted (GET /manager/vehicles).
// Sold is intentionally NOT shown here: the sold-checker can't attribute a sale
// to whoever's ad it was, so a dealership "sold" view read as salesperson credit
// would be misleading. We show the live posted inventory only. (The endpoint
// still returns a sold bucket; we just don't render it — left in the backend
// for now.) Draft listings (fb_posted=false) appear in neither state by design.
export default function Vehicles() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    managerApi.vehicles()
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setErr(errText(e)) })
    return () => { cancelled = true }
  }, [])

  if (!data && !err) return <Spinner />

  return (
    <div className="stack">
      <Notice kind="error">{err}</Notice>
      {data && (
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 className="section-title mb-0">Posted</h2>
            <span className="badge badge-blue">{data.posted_count}</span>
          </div>
          <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>live on Facebook across the team</p>
          {data.posted?.length === 0 && <div className="empty">No posted vehicles.</div>}
          <div className="grid-auto" style={{ gap: 10 }}>
            {data.posted?.map((v) => (
              <div key={v.listing_id} className="card" style={{ padding: '10px 14px', boxShadow: 'none' }}>
                <strong>{[v.year, v.make, v.model].filter(Boolean).join(' ') || '—'}</strong>
                <div className="mono muted" style={{ marginTop: 2 }}>{formatPrice(v.price)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
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

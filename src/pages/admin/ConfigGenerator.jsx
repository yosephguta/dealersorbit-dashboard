import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { adminApi } from '../../api'
import { Notice, Field, Spinner, StatusBadge, errText, fmtDate } from '../../components/ui'

// Config Generator — opened from the Review Queue for a specific dealer-config
// request (keyed by the requester's user_id). The admin pastes labeled HTML
// fragments, generates a config via Claude, previews the extracted sample
// values against the pasted HTML, then approves (as a new config, or mapped to
// an existing shared platform). Backed by /admin/dealer-config-generator/*.

// How each preview field's `source` renders as a badge.
const SOURCE_BADGE = {
  selector: { cls: 'badge-green', text: 'css' },
  title: { cls: 'badge-blue', text: 'from title' },
  label_scan: { cls: 'badge-blue', text: 'label scan' },
  missing: { cls: 'badge-red', text: 'miss' },
}

// The test account "Approve for Test" assigns to — dev vs prod.
const TEST_EMAIL = import.meta.env.DEV ? 'testdealer@dealersorbit.com' : 'yosephfl@gmail.com'

export default function ConfigGenerator() {
  const { userId, platformId: routePlatformId } = useParams()
  const editMode = !!routePlatformId   // opened to EDIT an existing config
  const navigate = useNavigate()

  const [req, setReq] = useState(null)       // request context (request mode)
  const [editMeta, setEditMeta] = useState(null)  // config meta (edit mode)
  const [loadErr, setLoadErr] = useState(null)

  // paste boxes
  const [sourceUrl, setSourceUrl] = useState('')
  const [cardUsed, setCardUsed] = useState('')
  const [cardNew, setCardNew] = useState('')
  const [priceHtml, setPriceHtml] = useState('')
  const [attrsHtml, setAttrsHtml] = useState('')
  const [photosHtml, setPhotosHtml] = useState('')
  const [notesForClaude, setNotesForClaude] = useState('')

  // generation / preview / approval state
  const [platformId, setPlatformId] = useState(null)
  const [config, setConfig] = useState(null)
  const [genWarnings, setGenWarnings] = useState([])
  const [cost, setCost] = useState(null) // {input, output, usd}
  const [preview, setPreview] = useState(null)
  const [activePlatforms, setActivePlatforms] = useState([])
  const [mapTo, setMapTo] = useState('')
  const [notifyUser, setNotifyUser] = useState(true)

  const [err, setErr] = useState(null)
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(null) // 'generate' | 'preview' | 'approve-new' | 'approve-map'

  const loadRequest = useCallback(async () => {
    setLoadErr(null)
    try {
      if (editMode) {
        // Load an existing config to edit (e.g. an active one from a help ticket).
        const p = await adminApi.getPlatform(routePlatformId)
        setEditMeta(p)
        setPlatformId(p.id)
        setConfig(p.config_json || null)
        setSourceUrl(p.source_url || '')
        const f = p.source_html_fragments || {}
        setCardUsed(f.inventory_card_html_used || '')
        setCardNew(f.inventory_card_html_new || '')
        setPriceHtml(f.price_html || '')
        setAttrsHtml(f.attributes_html || '')
        setPhotosHtml(f.photos_html || '')
      } else {
        const r = await adminApi.dealerConfigRequest(userId)
        setReq(r)
        // Prefill the source URL from the saved inventory URL (or the domain).
        setSourceUrl(r.dealer_inventory_url || (r.config_domain ? `https://${r.config_domain}/` : ''))
      }
    } catch (e) {
      setLoadErr(errText(e))
    }
  }, [editMode, routePlatformId, userId])

  useEffect(() => { loadRequest() }, [loadRequest])

  // Active platforms for the "map to existing" picker.
  useEffect(() => {
    adminApi.listPlatforms('active')
      .then((d) => setActivePlatforms(d?.platforms || []))
      .catch(() => setActivePlatforms([]))
  }, [])

  async function generate() {
    setBusy('generate'); setErr(null); setFlash(null); setPreview(null)
    try {
      const res = await adminApi.generateConfig({
        source_url: sourceUrl.trim(),
        dealer_config_request_user_id: userId ? Number(userId) : null,
        inventory_card_html_used: cardUsed.trim() || null,
        inventory_card_html_new: cardNew.trim() || null,
        price_html: priceHtml.trim() || null,
        attributes_html: attrsHtml.trim() || null,
        photos_html: photosHtml.trim() || null,
        notes_for_claude: notesForClaude.trim() || null,
      })
      setPlatformId(res.platform_id)
      setConfig(res.config)
      setGenWarnings(res.warnings || [])
      const it = res.input_tokens || 0, ot = res.output_tokens || 0
      setCost({ input: it, output: ot, usd: it / 1e6 * 3 + ot / 1e6 * 15 })
      setFlash(`Config generated (platform #${res.platform_id}). Review it, then Preview.`)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(null)
    }
  }

  const runPreview = useCallback(async () => {
    if (!platformId) return
    setBusy('preview'); setErr(null)
    try {
      setPreview(await adminApi.previewConfig(platformId))
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(null)
    }
  }, [platformId])

  async function approve(mapToId) {
    setBusy(mapToId ? 'approve-map' : 'approve-new'); setErr(null); setFlash(null)
    try {
      const res = await adminApi.approveGeneratedConfig(platformId, {
        map_to_existing_platform_id: mapToId ? Number(mapToId) : null,
        notify: notifyUser,
      })
      setFlash(res.message || 'Approved.')
      // Give the admin a beat to see the success, then return to the queue.
      setTimeout(() => navigate('/admin/review-queue'), 900)
    } catch (e) {
      setErr(errText(e))
      setBusy(null)
    }
  }

  // Approve for Test — activate + assign to the env's test account so the admin
  // can try it in the extension BEFORE approving for the real user. No redirect.
  async function approveForTest() {
    setBusy('approve-test'); setErr(null); setFlash(null)
    try {
      const res = await adminApi.assignPlatformToSalesperson(platformId, TEST_EMAIL, notifyUser)
      setFlash(`${res.message}. Now test it in the extension signed in as ${TEST_EMAIL}, then Approve for User.`)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(null)
    }
  }

  if (loadErr) return (
    <div className="stack">
      <Notice kind="error">{loadErr}</Notice>
      <Link className="btn btn-ghost btn-sm" to="/admin/review-queue">← Back to Review Queue</Link>
    </div>
  )
  if (!req && !editMeta) return <Spinner label="Loading…" />

  const canGenerate = !!sourceUrl.trim() && (!!cardUsed.trim() || !!cardNew.trim()) && busy !== 'generate'

  // Warn if the Source URL's domain differs from the request's domain (the
  // approval maps the Source URL's domain, so a leftover/prefilled URL is a trap).
  const bareDomain = (u) => (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
  const reqDomain = req ? (req.config_domain || bareDomain(req.dealership_url)) : null
  const srcDomain = bareDomain(sourceUrl)
  const domainMismatch = !editMode && srcDomain && reqDomain && srcDomain !== reqDomain
    ? { src: srcDomain, req: reqDomain } : null

  return (
    <div className="stack">
      <Link className="btn btn-ghost btn-sm" to="/admin/review-queue" style={{ alignSelf: 'flex-start' }}>
        ← Back to Review Queue
      </Link>

      {/* Context header */}
      {editMode ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong style={{ fontSize: 16 }}>Editing config #{editMeta.id}</strong>
              <div className="muted">{editMeta.platform_slug || editMeta.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ wordBreak: 'break-all' }}>{editMeta.source_url}</div>
              <StatusBadge status={editMeta.status} />
            </div>
          </div>
          <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>
            Use <strong>Preview</strong> and <strong>Redo this field</strong> to fix selectors —
            changes save to this config immediately (it stays {editMeta.status}). Then
            <strong> Approve for Test</strong> to re-check it in the extension.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong style={{ fontSize: 16 }}>{req.full_name || req.email}</strong>
              <div className="muted">{req.email}</div>
              <div className="muted">{req.dealership_name || 'No dealership name'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono">{req.config_domain || req.dealership_url || '—'}</div>
              <div className="muted" style={{ fontSize: 13 }}>Requested {fmtDate(req.requested_at)}</div>
              {req.resolved_to_active_config && <span className="badge badge-green" style={{ marginTop: 4 }}>config already live</span>}
              {!req.resolved_to_active_config && req.generation_in_progress && <span className="badge badge-blue" style={{ marginTop: 4 }}>generation in progress</span>}
            </div>
          </div>
          {req.dealer_inventory_url && (
            <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
              Inventory URL:{' '}
              <a href={req.dealer_inventory_url} target="_blank" rel="noreferrer" className="mono" style={{ wordBreak: 'break-all' }}>
                {req.dealer_inventory_url}
              </a>
            </div>
          )}
        </div>
      )}

      <Notice kind="error">{err}</Notice>
      <Notice kind="success">{flash}</Notice>

      {/* Paste boxes — request (generate) mode only */}
      {!editMode && (
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>1. Paste HTML fragments</h3>
        <Field label="Source URL (the dealer's inventory page)">
          <input className="input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.dealer.com/used-inventory/" />
        </Field>
        {domainMismatch && (
          <Notice kind="warn">
            The Source URL domain (<span className="mono">{domainMismatch.src}</span>) doesn't match this
            request's domain (<span className="mono">{domainMismatch.req}</span>). On approval the config is
            mapped to the Source URL's domain — set the correct dealer domain here or the mapping will be wrong.
          </Notice>
        )}
        <PasteBox label="Inventory Card (Used) — required" value={cardUsed} onChange={setCardUsed}
          placeholder="Outer HTML of one used-inventory vehicle card" />
        <PasteBox label="Inventory Card (New) — optional" value={cardNew} onChange={setCardNew}
          placeholder="Outer HTML of one new-inventory vehicle card (if the site differs)" />
        <PasteBox label="Price Selector — the price section from a detail page" value={priceHtml} onChange={setPriceHtml}
          placeholder="HTML around the final advertised price" />
        <PasteBox label="Attributes — color / mileage / VIN / body style" value={attrsHtml} onChange={setAttrsHtml}
          placeholder="HTML of the spec / attributes table" />
        <PasteBox label="Photos — the gallery" value={photosHtml} onChange={setPhotosHtml}
          placeholder="HTML of the photo gallery (img tags)" />
        <Field label="Notes for Claude (optional) — hints for obscure sites">
          <textarea className="input" rows={2} value={notesForClaude}
            onChange={(e) => setNotesForClaude(e.target.value)}
            placeholder="e.g. card titles are prefixed 'Pre-Owned' — ignore it · the real price label is 'Bell Price' · trim is the last word of the title" />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={!canGenerate} onClick={generate}>
            {busy === 'generate' ? 'Generating…' : 'Generate Config'}
          </button>
        </div>
      </div>
      )}

      {/* Generated config */}
      {config && (
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>2. Generated config <span className="muted">(platform #{platformId})</span></h3>
            <button className="btn btn-navy btn-sm" disabled={busy === 'preview'} onClick={runPreview}>
              {busy === 'preview' ? 'Previewing…' : 'Preview'}
            </button>
          </div>
          {cost && (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Cost: <strong>${cost.usd < 0.01 ? cost.usd.toFixed(4) : cost.usd.toFixed(2)}</strong>
              {' '}({cost.input.toLocaleString()} in / {cost.output.toLocaleString()} out tokens · Sonnet 4.6)
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Fields shown as <span className="mono">null</span> are normal — the extension fills them at runtime
            from the title (year/make/model/trim), spec labels (colors), or the VIN via NHTSA (body style,
            drivetrain, fuel). Use <strong>Preview</strong> to confirm the actual extracted values.
          </p>
          {genWarnings.length > 0 && (
            <Notice kind="warn">
              <strong>{genWarnings.length} generation warning{genWarnings.length === 1 ? '' : 's'}:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {genWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </Notice>
          )}
          <ConfigView config={config} />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>3. Preview — values extracted from the pasted HTML</h3>
          <div className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted">Vehicle cards matched:</span>
            <span className={`badge ${preview.vehicle_cards_match_count > 0 ? 'badge-green' : 'badge-red'}`}>
              {preview.vehicle_cards_match_count}
            </span>
            <span className="muted" style={{ marginLeft: 12 }}>Photos matched:</span>
            <span className={`badge ${preview.sample_photo_count > 0 ? 'badge-green' : 'badge-amber'}`}>
              {preview.sample_photo_count}
            </span>
          </div>
          {preview.card_title && (
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
              Card title: <span className="mono">{preview.card_title}</span>
            </div>
          )}
          <div className="stack" style={{ gap: 8 }}>
            {preview.fields?.map((f) => {
              const b = SOURCE_BADGE[f.source] || SOURCE_BADGE.missing
              return (
                <div key={f.key} style={{ padding: '8px 10px', border: '1px solid var(--line, #e5e7eb)', borderRadius: 8 }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <span className="muted">{f.label}</span>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="mono">{f.ok ? f.value : '—'}</span>
                      <span className={`badge ${b.cls}`}>{b.text}</span>
                    </span>
                  </div>
                  <RefineBox
                    field={f.key}
                    ok={f.ok}
                    platformId={platformId}
                    onFixed={runPreview}
                    onError={setErr}
                  />
                </div>
              )
            })}
          </div>
          {/* Photos — sample URLs + URL-include filter for mixed galleries */}
          <div style={{ marginTop: 12, padding: '10px', border: '1px solid var(--line, #e5e7eb)', borderRadius: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted">Photos ({preview.sample_photo_count}{preview.photos_url_include ? ` of ${preview.photos_total_matched} after filter` : ''})</span>
            </div>
            {preview.sample_photo_urls?.length > 0 && (
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                {preview.sample_photo_urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" title={u}>
                    <img src={u} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb' }} />
                  </a>
                ))}
              </div>
            )}
            <PhotoFilterBox
              platformId={platformId}
              current={preview.photos_url_include || ''}
              onApplied={runPreview}
              onError={setErr}
            />
          </div>

          {preview.warnings?.length > 0 && (
            <Notice kind="warn">
              <strong>{preview.warnings.length} note{preview.warnings.length === 1 ? '' : 's'}:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </Notice>
          )}
        </div>
      )}

      {/* Approve */}
      {config && (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>4. Approve</h3>

          <label className="row" style={{ gap: 8, marginBottom: 12, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={notifyUser} onChange={(e) => setNotifyUser(e.target.checked)} />
            Email the user a "config ready" notice (applies to both buttons below)
          </label>

          {/* Step 1: test it live */}
          <p className="muted" style={{ marginTop: 0, marginBottom: 6, fontSize: 13 }}>
            <strong>Step 1 — test it.</strong> Assigns this config to the test account
            (<span className="mono">{TEST_EMAIL}</span>) and activates it, so you can try it in
            the extension before it goes to the real user.
          </p>
          <button className="btn btn-primary" disabled={!!busy} onClick={approveForTest}>
            {busy === 'approve-test' ? 'Assigning…' : 'Approve for Test'}
          </button>

          <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid var(--line, #e5e7eb)' }} />

          {/* Step 2: approve for the real user */}
          <p className="muted" style={{ marginTop: 0, marginBottom: 6, fontSize: 13 }}>
            <strong>Step 2 — approve for the user.</strong> Maps the domain to the requester and
            emails them. Or map to an existing shared platform (same-template sites).
          </p>
          <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
            Missing fields are OK to approve — the extension fills them at runtime (title /
            spec labels / NHTSA).
          </p>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <button className="btn btn-navy" disabled={!!busy} onClick={() => approve(null)}>
              {busy === 'approve-new' ? 'Approving…' : 'Approve for User'}
            </button>
            <span className="muted">or</span>
            <Field label="Map to existing platform">
              <select className="select" value={mapTo} onChange={(e) => setMapTo(e.target.value)}>
                <option value="">— select an active platform —</option>
                {activePlatforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} {p.platform_slug || p.name} — {p.source_url}
                  </option>
                ))}
              </select>
            </Field>
            <button className="btn btn-navy" disabled={!!busy || !mapTo} onClick={() => approve(mapTo)}>
              {busy === 'approve-map' ? 'Mapping…' : 'Approve — map to selected'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PasteBox({ label, value, onChange, placeholder }) {
  return (
    <Field label={label}>
      <textarea
        className="input mono"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ fontSize: 12, whiteSpace: 'pre', overflowX: 'auto' }}
      />
    </Field>
  )
}

// Shown inline under EVERY preview field: paste a narrower HTML snippet to fix a
// missing field OR correct a false positive. Optional "Notes for Claude" makes
// the backend re-derive the selector with Claude (for values that need
// interpretation, e.g. body style combined with a seat count).
function RefineBox({ field, ok, platformId, onFixed, onError }) {
  const [open, setOpen] = useState(false)
  const [html, setHtml] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  async function submit() {
    setBusy(true); setNote(null)
    try {
      const res = await adminApi.refineField(platformId, {
        field,
        html: html.trim(),
        value: value.trim() || null,
        notes: notes.trim() || null,   // presence triggers Claude mode
      })
      if (res.ok) {
        setNote(`Set to "${res.sample_value}" → ${res.selector}`)
        setOpen(false)
        onFixed?.()  // re-run the full preview
      } else {
        setNote((res.warnings || []).join(' ') || 'Could not derive a selector.')
      }
    } catch (e) {
      onError?.(errText(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          {ok ? 'Redo this field' : '+ Paste HTML to find this'}
        </button>
        {note && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{note}</span>}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--line, #e5e7eb)' }}>
      <p className="muted" style={{ margin: '0 0 6px', fontSize: 12 }}>
        Paste the smallest HTML snippet containing this value. Optionally type the exact value,
        and/or add notes for Claude (e.g. “body style only, ignore the seat count after the slash”).
        Adding notes uses Claude to pick the selector.
      </p>
      <textarea
        className="input mono"
        rows={3}
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        placeholder={`<dd class="int-color">Charcoal</dd>`}
        style={{ fontSize: 12, whiteSpace: 'pre', overflowX: 'auto' }}
      />
      <input className="input" value={value} onChange={(e) => setValue(e.target.value)}
        placeholder="Exact value (optional)" style={{ marginTop: 6 }} />
      <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for Claude (optional) — using this re-derives the selector with Claude"
        style={{ marginTop: 6 }} />
      <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
        <button className="btn btn-primary btn-sm" disabled={busy || !html.trim()} onClick={submit}>
          {busy ? 'Working…' : (notes.trim() ? 'Ask Claude' : 'Find selector')}
        </button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

// Photos can't always be separated by a CSS selector (main gallery vs "similar
// vehicles" share markup). This sets a URL substring that ONLY this car's photos
// contain (e.g. "imagescf.dealercenter.net/719") — the extension keeps just those.
function PhotoFilterBox({ platformId, current, onApplied, onError }) {
  const [val, setVal] = useState(current || '')
  const [busy, setBusy] = useState(false)
  async function apply(clear = false) {
    setBusy(true)
    try {
      await adminApi.refineField(platformId, { field: 'photos', url_include: clear ? '' : val.trim() })
      if (clear) setVal('')
      onApplied?.()  // re-run preview to show the filtered set
    } catch (e) {
      onError?.(errText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ marginTop: 6 }}>
      <p className="muted" style={{ margin: '0 0 4px', fontSize: 12 }}>
        Wrong photos from other cars? Enter a URL substring only this car's photos contain
        (from the service-worker logs) — the extension keeps just those.
      </p>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <input className="input mono" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder="e.g. imagescf.dealercenter.net/719" style={{ fontSize: 12 }} />
        <button className="btn btn-primary btn-sm" disabled={busy || !val.trim()} onClick={() => apply(false)}>
          {busy ? '…' : 'Apply filter'}
        </button>
        {current && (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => apply(true)}>Clear</button>
        )}
      </div>
    </div>
  )
}

function ConfigView({ config }) {
  // Formatted, readable JSON (strip internal underscore keys from the top view).
  const clean = { ...config }
  delete clean._generation_warnings
  delete clean._usage
  return (
    <pre className="mono" style={{
      background: '#0d1f3c', color: '#e6edf6', padding: 14, borderRadius: 8,
      overflowX: 'auto', fontSize: 12, lineHeight: 1.5, maxHeight: 420, margin: '8px 0 0',
    }}>
      {JSON.stringify(clean, null, 2)}
    </pre>
  )
}

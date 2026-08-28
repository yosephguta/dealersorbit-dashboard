import { useEffect, useState } from 'react'
import { adminApi } from '../api'

// Backend-validated enums (admin.py VALID_PLANS / VALID_STATUS).
export const PLANS = ['pro', 'elite', 'dealership']
export const STATUSES = ['active', 'trial', 'past_due', 'cancelled']
export const ROLES = ['salesperson', 'manager', 'admin', 'independent']

// Friendly names for the well-known default voices. Endpoints (analytics
// top_voices, manager favorite_voice) return raw ElevenLabs IDs; this keeps the
// label reading consistent across both dashboards. Unknown/custom IDs fall back
// to the raw id via voiceLabel().
export const VOICE_NAMES = {
  Gubgw9l4dtIoQA9YZHgx: 'Brian',
  zDMHo7CPscBTgfDtPOWl: 'Claus',
}

// Returns the friendly name if known, else the raw id (or null passthrough).
export function voiceLabel(voiceId) {
  if (!voiceId) return voiceId
  return VOICE_NAMES[voiceId] || voiceId
}

// Loads the dealership list once for pickers (Users / BulkAssign / ReviewQueue).
export function useDealerships() {
  const [dealerships, setDealerships] = useState([])
  const [err, setErr] = useState(null)
  useEffect(() => {
    let cancelled = false
    adminApi.listDealerships()
      .then((d) => { if (!cancelled) setDealerships(d) })
      .catch((e) => { if (!cancelled) setErr(e) })
    return () => { cancelled = true }
  }, [])
  return { dealerships, err }
}

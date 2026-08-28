import { useParams } from 'react-router-dom'
import { useCallback } from 'react'
import { managerApi } from '../../api'
import SalespersonDetail from '../../components/SalespersonDetail'

// STEP 2 — Manager drill-down. Thin wrapper: the whole view is the shared
// SalespersonDetail, backed by the dealership-scoped manager endpoint.
export default function TeamMember() {
  const { userId } = useParams()
  const fetcher = useCallback((params) => managerApi.teamMember(userId, params), [userId])
  return <SalespersonDetail fetcher={fetcher} backTo="/manager" backLabel="Back to team" />
}

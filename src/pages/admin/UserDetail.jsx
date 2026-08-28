import { useParams } from 'react-router-dom'
import { useCallback } from 'react'
import { adminApi } from '../../api'
import SalespersonDetail from '../../components/SalespersonDetail'

// Admin user detail — the SAME view a manager sees for a salesperson, backed by
// the admin activity endpoint (any user, no dealership scope). Reached by
// clicking a row in the admin Users table.
export default function UserDetail() {
  const { userId } = useParams()
  const fetcher = useCallback((params) => adminApi.userActivity(userId, params), [userId])
  return <SalespersonDetail fetcher={fetcher} backTo="/admin/users" backLabel="Back to users" />
}

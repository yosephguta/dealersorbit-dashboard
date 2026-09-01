import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { managerApi } from '../api'
import { errText } from './ui'

const ADMIN_NAV = [
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/dealerships', label: 'Dealerships' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/bulk-assign', label: 'Bulk Assign' },
  { to: '/admin/review-queue', label: 'Review Queue' },
]

const MANAGER_NAV = [
  { to: '/manager', label: 'Team' },
  { to: '/manager/leaderboard', label: 'Leaderboard' },
  { to: '/manager/vehicles', label: 'Vehicles' },
]

export default function Layout({ title, children }) {
  const { user, logout } = useAuth()
  const nav = user?.role === 'admin' ? ADMIN_NAV : MANAGER_NAV
  const [billingBusy, setBillingBusy] = useState(false)

  async function openBilling() {
    setBillingBusy(true)
    try {
      const { url } = await managerApi.billingPortal()
      if (url) window.location.href = url   // Stripe Customer Portal — change plan / cancel
    } catch (e) {
      alert(errText(e) || 'Could not open billing. Make sure this account has a subscription.')
      setBillingBusy(false)
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">Dealers<span>Orbit</span></div>
        <div className="sidebar-role">{user?.role === 'admin' ? 'Admin Console' : 'Manager Console'}</div>
        <nav>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/manager'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who">{user?.email}</div>
          {user?.role === 'manager' && (
            <button className="btn btn-ghost btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', background: 'transparent', marginBottom: 8 }}
              disabled={billingBusy} onClick={openBilling}>
              {billingBusy ? 'Opening…' : 'Manage Subscription'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', background: 'transparent' }} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <h1>{title}</h1>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}

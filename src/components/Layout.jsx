import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'

const ADMIN_NAV = [
  { to: '/admin/dealerships', label: 'Dealerships' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/bulk-assign', label: 'Bulk Assign' },
  { to: '/admin/review-queue', label: 'Review Queue' },
  { to: '/admin/analytics', label: 'Analytics' },
]

const MANAGER_NAV = [
  { to: '/manager', label: 'Team' },
  { to: '/manager/leaderboard', label: 'Leaderboard' },
  { to: '/manager/vehicles', label: 'Vehicles' },
]

export default function Layout({ title, children }) {
  const { user, logout } = useAuth()
  const nav = user?.role === 'admin' ? ADMIN_NAV : MANAGER_NAV

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

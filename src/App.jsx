import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Layout from './components/Layout'

import Dealerships from './pages/admin/Dealerships'
import Users from './pages/admin/Users'
import UserDetail from './pages/admin/UserDetail'
import BulkAssign from './pages/admin/BulkAssign'
import ReviewQueue from './pages/admin/ReviewQueue'
import Analytics from './pages/admin/Analytics'
import TeamRoster from './pages/manager/TeamRoster'
import TeamMember from './pages/manager/TeamMember'
import Leaderboard from './pages/manager/Leaderboard'
import Vehicles from './pages/manager/Vehicles'

// Where a given role's shell lives.
function homeFor(role) {
  if (role === 'admin') return '/admin/dealerships'
  if (role === 'manager') return '/manager'
  return null
}

// Guards a subtree to a required role. Wrong role → bounce to that user's own
// home (never a blank page). No user → login.
function RequireRole({ role, children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.role !== role) {
    const home = homeFor(user.role)
    return <Navigate to={home || '/login'} replace />
  }
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  // Resolving a stored token — don't flash the login screen.
  if (loading) return <Spinner label="Loading…" />

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homeFor(user.role) || '/login'} replace /> : <Login />}
      />

      {/* Admin shell */}
      <Route
        path="/admin/dealerships"
        element={<RequireRole role="admin"><Layout title="Dealerships"><Dealerships /></Layout></RequireRole>}
      />
      <Route
        path="/admin/users"
        element={<RequireRole role="admin"><Layout title="Users"><Users /></Layout></RequireRole>}
      />
      <Route
        path="/admin/users/:userId"
        element={<RequireRole role="admin"><Layout title="User Detail"><UserDetail /></Layout></RequireRole>}
      />
      <Route
        path="/admin/bulk-assign"
        element={<RequireRole role="admin"><Layout title="Bulk Assign"><BulkAssign /></Layout></RequireRole>}
      />
      <Route
        path="/admin/review-queue"
        element={<RequireRole role="admin"><Layout title="Config Review Queue"><ReviewQueue /></Layout></RequireRole>}
      />
      <Route
        path="/admin/analytics"
        element={<RequireRole role="admin"><Layout title="Analytics"><Analytics /></Layout></RequireRole>}
      />
      <Route path="/admin" element={<Navigate to="/admin/dealerships" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin/dealerships" replace />} />

      {/* Manager shell */}
      <Route
        path="/manager"
        element={<RequireRole role="manager"><Layout title="Team"><TeamRoster /></Layout></RequireRole>}
      />
      <Route
        path="/manager/team/:userId"
        element={<RequireRole role="manager"><Layout title="Salesperson"><TeamMember /></Layout></RequireRole>}
      />
      <Route
        path="/manager/leaderboard"
        element={<RequireRole role="manager"><Layout title="Leaderboard"><Leaderboard /></Layout></RequireRole>}
      />
      <Route
        path="/manager/vehicles"
        element={<RequireRole role="manager"><Layout title="Vehicles"><Vehicles /></Layout></RequireRole>}
      />
      <Route path="/manager/*" element={<Navigate to="/manager" replace />} />

      {/* Root: route to the user's home, or login. */}
      <Route
        path="*"
        element={<Navigate to={user ? (homeFor(user.role) || '/login') : '/login'} replace />}
      />
    </Routes>
  )
}

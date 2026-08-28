import { useState } from 'react'
import { useAuth } from '../auth'
import { Notice, errText } from '../components/ui'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      // AuthProvider updates `user`; App re-routes to the correct shell automatically.
      await login(email.trim(), password)
    } catch (e) {
      setErr(errText(e) || 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-logo">Dealers<span>Orbit</span></div>
        <div className="login-sub">Admin &amp; Manager Dashboard</div>
        <Notice kind="error">{err}</Notice>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" value={email} autoFocus
            onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

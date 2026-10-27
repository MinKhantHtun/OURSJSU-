import { useState } from 'react'
import type { PageProps } from '../shared/api/types'
import { ErrorNotice } from '../components/Feedback'

export default function Login({ onSignIn, onNavigate }: PageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  async function submit() {
    if (!onSignIn) return
    setPending(true)
    setError(null)
    try {
      await onSignIn({ email, password })
      onNavigate?.('Dashboard')
    } catch (err) { setError(err) }
    finally { setPending(false) }
  }
  return <section className="login-page">
    <div><h1>Your next semester starts here.</h1><p>Find sections, understand prerequisites, and keep track of the courses you need.</p></div>
    <form className="login-form" onSubmit={e => { e.preventDefault(); void submit() }}>
      <h2>Sign in to OurSJSU</h2>
      <label>Email<input name="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className="primary" disabled={pending || !onSignIn}>{pending ? 'Signing in…' : 'Sign in'}</button>
      <ErrorNotice error={error} />
    </form>
  </section>
}

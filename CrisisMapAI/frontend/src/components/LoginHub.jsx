import React, { useMemo, useState } from 'react'
import { loginWithPassword, requestOtp, verifyOtp } from '../api/client'

const sessionKey = 'crisismap_session'
const phonePattern = /^\+?[0-9\s().-]{7,20}$/

const LoginHub = ({ onLoggedIn }) => {
  const [role, setRole] = useState('victim')
  const [mode, setMode] = useState('password')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpPreview, setOtpPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const label = useMemo(() => {
    if (role === 'victim') return 'Email or mobile phone'
    if (role === 'organization') return 'Government registration ID'
    return 'Employee ID'
  }, [role])

  const canUseOtp = role !== 'organization'
  const validationMessage = useMemo(() => {
    const cleaned = identifier.trim()
    if (!cleaned) return 'Enter your login identifier.'
    if (role === 'victim' && !cleaned.includes('@') && !phonePattern.test(cleaned)) {
      return 'Victims must use a valid email address or mobile phone.'
    }
    if (role === 'organization' && cleaned.length < 4) {
      return 'Organizations must use their government registration ID.'
    }
    if (role === 'responder' && cleaned.length < 3) {
      return 'Responders must use their employee ID.'
    }
    if (mode === 'password' && password.length < 8) {
      return 'Password must be at least 8 characters.'
    }
    if (mode === 'otp' && otpCode && otpCode.length !== 6) {
      return 'OTP must be 6 digits.'
    }
    return ''
  }, [identifier, mode, otpCode, password.length, role])

  const handlePasswordLogin = async () => {
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    setLoading(true)
    setError('')
    try {
      const session = await loginWithPassword({ role, login_identifier: identifier, password })
      window.localStorage.setItem(sessionKey, JSON.stringify(session))
      onLoggedIn(session)
    } catch (loginError) {
      setError(loginError?.response?.data?.detail || 'Unable to log in.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpRequest = async () => {
    if (validationMessage && validationMessage !== 'OTP must be 6 digits.') {
      setError(validationMessage)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await requestOtp({ role, login_identifier: identifier })
      setOtpPreview(response.otp_preview || '')
    } catch (otpError) {
      setError(otpError?.response?.data?.detail || 'Unable to request OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpVerify = async () => {
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    setLoading(true)
    setError('')
    try {
      const session = await verifyOtp({ role, login_identifier: identifier, otp_code: otpCode })
      window.localStorage.setItem(sessionKey, JSON.stringify(session))
      onLoggedIn(session)
    } catch (otpError) {
      setError(otpError?.response?.data?.detail || 'Unable to verify OTP.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel space-y-5">
      <div className="flex flex-wrap gap-2">
        {['victim', 'organization', 'responder'].map((value) => (
          <button key={value} type="button" className={role === value ? 'badge badge-high' : 'badge border border-slate-200 bg-white text-slate-600'} onClick={() => { setRole(value); if (value === 'organization') setMode('password') }}>
            {value}
          </button>
        ))}
      </div>
      {canUseOtp && (
        <div className="flex gap-2">
          <button type="button" className={mode === 'password' ? 'badge badge-medium' : 'badge border border-slate-200 bg-white text-slate-600'} onClick={() => setMode('password')}>Password</button>
          <button type="button" className={mode === 'otp' ? 'badge badge-medium' : 'badge border border-slate-200 bg-white text-slate-600'} onClick={() => setMode('otp')}>OTP</button>
        </div>
      )}
      <label>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <input className="input-shell" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        <span className="mt-1 block text-xs text-slate-500">
          {role === 'victim' ? 'Use the phone number or email saved during registration.' : role === 'organization' ? 'Use the organization registration number submitted during onboarding.' : 'Use the employee ID or badge number stored during responder registration.'}
        </span>
      </label>
      {mode === 'password' ? (
        <>
          <label>
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input className="input-shell" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="button" className="button-primary" disabled={!identifier || !password || loading} onClick={handlePasswordLogin}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </>
      ) : (
        <>
          <div className="flex gap-3">
            <button type="button" className="button-primary" disabled={!identifier || loading} onClick={handleOtpRequest}>
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
            <input className="input-shell" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Enter OTP" />
            <button type="button" className="button-soft" disabled={!identifier || !otpCode || loading} onClick={handleOtpVerify}>Verify OTP</button>
          </div>
          {otpPreview && <div className="rounded-[20px] bg-amber-50 px-4 py-3 text-sm text-amber-800">Development OTP preview: <span className="font-bold">{otpPreview}</span></div>}
        </>
      )}
      {!error && validationMessage && <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{validationMessage}</div>}
      {error && <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    </section>
  )
}

export default LoginHub

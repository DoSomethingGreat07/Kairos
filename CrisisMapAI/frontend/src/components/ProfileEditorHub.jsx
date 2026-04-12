import React, { useEffect, useState } from 'react'
import { getProfile, updateProfile } from '../api/client'
import LoginHub from './LoginHub'

const sessionKey = 'crisismap_session'

const ProfileEditorHub = ({ session: externalSession, onLoggedIn, onLoggedOut }) => {
  const [session, setSession] = useState(() => {
    if (externalSession) return externalSession
    const raw = window.localStorage.getItem(sessionKey)
    return raw ? JSON.parse(raw) : null
  })
  const [profile, setProfile] = useState(null)
  const [editableProfile, setEditableProfile] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const clearSession = () => {
    window.localStorage.removeItem(sessionKey)
    setSession(null)
    setProfile(null)
    setEditableProfile('')
    onLoggedOut?.()
  }

  useEffect(() => {
    if (externalSession !== undefined) {
      setSession(externalSession || null)
    }
  }, [externalSession])

  useEffect(() => {
    const loadProfile = async () => {
      if (!session) return
      try {
        setError('')
        const result = await getProfile(session.role, session.subject_id)
        setProfile(result)
        setEditableProfile(JSON.stringify(result.profile_data || {}, null, 2))
      } catch (loadError) {
        const detail = loadError?.response?.data?.detail || 'Unable to load profile.'
        if (loadError?.response?.status === 404) {
          setError(`${detail} Please log in again so we can refresh the active profile mapping.`)
          clearSession()
          return
        }
        setError(detail)
      }
    }
    loadProfile()
  }, [session])

  const handleSave = async () => {
    setMessage('')
    setError('')
    try {
      const parsed = JSON.parse(editableProfile)
      const updated = await updateProfile({
        role: session.role,
        subject_id: session.subject_id,
        profile_data: parsed,
      })
      setProfile((prev) => ({ ...prev, ...updated }))
      setMessage('Profile updated.')
    } catch (saveError) {
      setError(saveError?.response?.data?.detail || 'Profile update failed or JSON is invalid.')
    }
  }

  const logout = () => clearSession()

  if (!session) {
    return (
      <div className="space-y-6">
        <section className="panel">
          <p className="section-kicker">Tier 5</p>
          <h2 className="panel-title mt-2">Login</h2>
          <p className="panel-subtitle">Victims and responders can use OTP or password. Organizations use registration ID and password.</p>
        </section>
        <LoginHub
          onLoggedIn={(nextSession) => {
            setSession(nextSession)
            onLoggedIn?.(nextSession)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-kicker">Profile editor</p>
            <h2 className="panel-title mt-2">{session.role} profile</h2>
            <p className="panel-subtitle mt-2">
              Update the stored registration payload for this account. These fields feed routing, capability matching, notifications, and SOS defaults.
            </p>
          </div>
          <button type="button" className="button-soft" onClick={logout}>Log out</button>
        </div>
      </section>
      <section className="panel">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-[18px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">Role</span>
            <span className="mt-1 block font-semibold capitalize">{session.role}</span>
          </div>
          <div className="rounded-[18px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">Subject ID</span>
            <span className="mt-1 block font-mono text-xs">{session.subject_id}</span>
          </div>
          <div className="rounded-[18px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">Login ID</span>
            <span className="mt-1 block break-all font-semibold">{session.login_identifier}</span>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700">Profile JSON</p>
        <textarea className="input-shell min-h-[420px] font-mono text-sm" value={editableProfile} onChange={(e) => setEditableProfile(e.target.value)} />
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className="button-primary" onClick={handleSave}>Save profile</button>
          {message && <span className="text-sm text-emerald-700">{message}</span>}
          {error && <span className="text-sm text-rose-700">{error}</span>}
        </div>
      </section>
    </div>
  )
}

export default ProfileEditorHub

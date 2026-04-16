import React, { useEffect, useMemo, useState } from 'react'
import { BrowserRouter as Router, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './components/HomePage'
import Dashboard from './components/Dashboard'
import SOSForm from './components/SOSForm'
import IncidentMap from './components/IncidentMap'
import CoordinatorPanel from './components/CoordinatorPanel'
import ResponderPanel from './components/ResponderPanel'
import VictimPanel from './components/VictimPanel'
import RegistrationPage from './components/RegistrationPage'
import LoginPage from './components/LoginPage'
import ProfileEditorHub from './components/ProfileEditorHub'
import RoleWorkspace from './components/RoleWorkspace'
import IncidentDashboard from './components/IncidentDashboard'

const sessionKey = 'crisismap_session'

const readSession = () => {
  const raw = window.localStorage.getItem(sessionKey)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const RequireSession = ({ session, children }) => {
  if (!session) return <Navigate to="/login" replace />
  return children
}

const RequireRole = ({ session, roles, children }) => {
  if (!session) return <Navigate to="/login" replace />
  if (!roles.includes(session.role)) return <Navigate to="/workspace" replace />
  return children
}

function App() {
  const [session, setSession] = useState(() => readSession())

  useEffect(() => {
    const handleStorage = () => setSession(readSession())
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const handleLoggedIn = (nextSession) => setSession(nextSession)
  const handleLoggedOut = () => setSession(null)

  const navItems = useMemo(() => {
    if (!session) {
      return []
    }

    if (session.role === 'victim') {
      return [
        { to: '/workspace', label: 'Workspace' },
        { to: '/sos', label: 'Emergency SOS' },
        { to: '/account', label: 'Profile' },
      ]
    }

    if (session.role === 'responder') {
      return [
        { to: '/workspace', label: 'Workspace' },
        { to: '/responder', label: 'Assignments' },
        { to: '/map', label: 'Map' },
        { to: '/account', label: 'Profile' },
      ]
    }

    return [
      { to: '/workspace', label: 'Workspace' },
      { to: '/overview', label: 'Overview' },
      { to: '/coordinator', label: 'Coordinator' },
      { to: '/map', label: 'Map' },
      { to: '/account', label: 'Profile' },
    ]
  }, [session])

  return (
    <Router>
      <div className="min-h-screen bg-app">
        <div className="app-shell">
          <header className="topbar">
            <NavLink to="/" className="brand-lockup">
              <div>
                <p className="eyebrow">Live Emergency Coordination</p>
                <h1 className="brand-title">CrisisMap AI</h1>
              </div>
            </NavLink>

            <div className="topbar-right">
              {session ? (
                <>
                  <div className="workspace-badge">
                    <span className="status-dot" />
                    {session.role} session
                  </div>
                  <button
                    type="button"
                    className="button-soft"
                    onClick={() => {
                      window.localStorage.removeItem(sessionKey)
                      setSession(null)
                      window.location.href = '/'
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <div className="header-chip">
                    <span className="status-dot" />
                    System ready
                  </div>
                  <NavLink to="/login" className="button-soft">Login</NavLink>
                  <NavLink to="/register" className="button-primary">Register</NavLink>
                </>
              )}
            </div>
          </header>

          {session && (
            <nav className="app-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-pill ${isActive ? 'nav-pill-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          <main className="mt-8 flex-1">
            <Routes>
              <Route path="/" element={<HomePage session={session} />} />
              <Route path="/register" element={<RegistrationPage />} />
              <Route path="/login" element={<LoginPage session={session} onLoggedIn={handleLoggedIn} onLoggedOut={handleLoggedOut} />} />
              <Route
                path="/sos"
                element={(
                  <RequireRole session={session} roles={['victim']}>
                    <SOSForm />
                  </RequireRole>
                )}
              />
              <Route
                path="/workspace"
                element={(
                  <RequireSession session={session}>
                    <RoleWorkspace session={session} />
                  </RequireSession>
                )}
              />
              <Route
                path="/overview"
                element={(
                  <RequireRole session={session} roles={['organization']}>
                    <Dashboard />
                  </RequireRole>
                )}
              />
              <Route
                path="/coordinator"
                element={(
                  <RequireRole session={session} roles={['organization']}>
                    <CoordinatorPanel />
                  </RequireRole>
                )}
              />
              <Route
                path="/responder"
                element={(
                  <RequireRole session={session} roles={['responder']}>
                    <ResponderPanel />
                  </RequireRole>
                )}
              />
              <Route
                path="/map"
                element={(
                  <RequireRole session={session} roles={['organization', 'responder']}>
                    <IncidentMap />
                  </RequireRole>
                )}
              />
              <Route path="/victim/:sosId" element={<VictimPanel />} />
              <Route path="/incident/:sosId" element={<IncidentDashboard />} />
              <Route
                path="/account"
                element={(
                  <RequireSession session={session}>
                    <ProfileEditorHub session={session} onLoggedIn={handleLoggedIn} onLoggedOut={handleLoggedOut} />
                  </RequireSession>
                )}
              />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App

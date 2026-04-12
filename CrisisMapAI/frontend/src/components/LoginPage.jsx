import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import LoginHub from './LoginHub'

const LoginPage = ({ session, onLoggedIn, onLoggedOut }) => {
  const [localSession, setLocalSession] = useState(session)

  return (
    <div className="mx-auto max-w-4xl w-full space-y-8 py-12 px-4 flex flex-col justify-center min-h-[70vh]">
      <section className="panel page-hero text-center items-center flex flex-col">
        <div>
          <p className="section-kicker">Login</p>
          <h2 className="panel-title mt-2 text-3xl">Sign in without the clutter</h2>
          <p className="panel-subtitle mt-3 max-w-3xl">
            Victims and responders can authenticate with password or OTP. Organizations use their registration number and password. Profile editing stays on its own dedicated page.
          </p>
        </div>
        <Link to="/account" className="button-soft">
          Open profile editor
        </Link>
      </section>

      {(localSession || session) ? (
        <section className="panel text-center flex flex-col items-center">
          <p className="section-kicker">Active session</p>
          <h3 className="panel-title mt-2">You are already logged in</h3>
          <p className="panel-subtitle mt-2">
            Signed in as <span className="font-semibold capitalize text-slate-900">{(localSession || session).role}</span> with identifier <span className="font-semibold text-slate-900">{(localSession || session).login_identifier}</span>.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/workspace" className="button-primary">Open workspace</Link>
            <Link to="/account" className="button-soft">Manage profile</Link>
            <button
              type="button"
              className="button-soft"
              onClick={() => {
                window.localStorage.removeItem('crisismap_session')
                setLocalSession(null)
                onLoggedOut?.()
              }}
            >
              Log out
            </button>
          </div>
        </section>
      ) : (
        <LoginHub
          onLoggedIn={(nextSession) => {
            setLocalSession(nextSession)
            onLoggedIn?.(nextSession)
          }}
        />
      )}
    </div>
  )
}

export default LoginPage

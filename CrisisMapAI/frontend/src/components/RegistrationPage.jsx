import React from 'react'
import RegistrationHub from './RegistrationHub'

const RegistrationPage = () => (
  <div className="space-y-6">
    <section className="panel page-hero">
      <div>
        <p className="section-kicker">Registration</p>
        <h2 className="panel-title mt-2 text-3xl">Create the right CrisisMap AI account</h2>
        <p className="panel-subtitle mt-3 max-w-3xl">
          Each registration flow is designed around what the response system actually needs: victim defaults for SOS intake, organization verification and resources, and responder capability matching.
        </p>
      </div>
      <div className="rounded-[22px] bg-slate-950 px-5 py-4 text-sm text-white shadow-[0_18px_48px_rgba(15,23,42,0.22)]">
        Drafts save automatically as you progress, so you can return and continue where you left off.
      </div>
    </section>
    <RegistrationHub />
  </div>
)

export default RegistrationPage

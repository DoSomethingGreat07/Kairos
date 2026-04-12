import React from 'react'
import { Link } from 'react-router-dom'

const valuePoints = [
  'Structured SOS intake with dispatch-critical data',
  'Role-based onboarding for victims, organizations, and responders',
  'Verified resource and capability data connected to response workflows',
]

const sections = [
  {
    title: 'Why CrisisMap AI',
    body: 'The platform brings emergency intake, operational identity, responder capability matching, and live coordination into one system so critical information is not lost between tools.',
  },
  {
    title: 'Before login',
    body: 'Visitors see a simple product page with clear information and clean entry points for registration and login. No operational clutter, no mixed-role confusion.',
  },
  {
    title: 'After login',
    body: 'Each role lands in a focused workspace that reflects their actual responsibilities: victims manage SOS readiness, responders manage assignment readiness, and organizations manage operations.',
  },
]

const HomePage = ({ session }) => (
  <div className="landing-page">
    <section className="landing-hero">
      <p className="eyebrow">Emergency Operations Platform</p>
      <h1 className="landing-title">CrisisMap AI coordinates intake, dispatch, and response with role-specific workflows.</h1>
      <p className="landing-copy">
        Built for emergency scenarios where speed, clarity, and operational structure matter. Registration data, incident intake, routing, assignment, and live coordination all connect through one system.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {session ? (
          <>
            <Link to="/workspace" className="button-primary min-w-[180px]">Open workspace</Link>
            <Link to="/account" className="button-soft min-w-[180px]">Manage profile</Link>
          </>
        ) : (
          <>
            <Link to="/register" className="button-primary min-w-[180px]">Register</Link>
            <Link to="/login" className="button-soft min-w-[180px]">Login</Link>
          </>
        )}
      </div>
    </section>

    <section className="landing-strip">
      {valuePoints.map((point) => (
        <div key={point} className="landing-strip-item">
          {point}
        </div>
      ))}
    </section>

    <section className="landing-sections">
      {sections.map((section) => (
        <div key={section.title} className="landing-section-card">
          <h2 className="landing-section-title">{section.title}</h2>
          <p className="landing-section-copy">{section.body}</p>
        </div>
      ))}
    </section>

    <section className="landing-bottom">
      <div className="landing-bottom-card">
        <p className="section-kicker">For victims</p>
        <h3 className="panel-title mt-2">Create a safety-ready profile</h3>
        <p className="panel-subtitle mt-3">
          Store location, household, medical, and communication defaults so the SOS flow can stay fast and accurate during a crisis.
        </p>
      </div>
      <div className="landing-bottom-card">
        <p className="section-kicker">For organizations</p>
        <h3 className="panel-title mt-2">Publish verified resources</h3>
        <p className="panel-subtitle mt-3">
          Register coverage zones, vehicles, shelters, and responder rosters in a format that is ready for live operational use.
        </p>
      </div>
      <div className="landing-bottom-card">
        <p className="section-kicker">For responders</p>
        <h3 className="panel-title mt-2">Be matched correctly</h3>
        <p className="panel-subtitle mt-3">
          Keep certifications, equipment, and deployment coverage current so assignment decisions reflect real capability.
        </p>
      </div>
    </section>
  </div>
)

export default HomePage

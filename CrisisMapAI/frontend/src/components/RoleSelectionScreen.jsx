import React from 'react'

const roles = [
  {
    id: 'victim',
    title: 'Victim',
    description: 'Register personal identity, location profile, and emergency defaults so SOS reports can be auto-populated safely.',
    active: true,
  },
  {
    id: 'organization',
    title: 'Organization',
    description: 'Register operational coverage, equipment, shelters, and organization codes before responder accounts are linked.',
    active: true,
  },
  {
    id: 'responder',
    title: 'Responder',
    description: 'Link to a verified organization, register capabilities and certifications, and become assignment-ready.',
    active: true,
  },
]

const RoleSelectionScreen = ({ onSelectRole }) => (
  <div className="space-y-6">
    <section className="panel">
      <p className="section-kicker">Three-role onboarding</p>
      <h2 className="panel-title mt-2">Choose a registration path</h2>
      <p className="panel-subtitle">
        Every role now connects directly to the live response pipeline, from victim SOS defaults to verified organization resources and responder capability matching.
      </p>
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      {roles.map((role) => (
        <div key={role.id} className="panel flex flex-col justify-between">
          <div>
            <p className="section-kicker">{role.active ? 'Available now' : 'Next tier'}</p>
            <h3 className="panel-title mt-2">{role.title}</h3>
            <p className="panel-subtitle mt-3">{role.description}</p>
          </div>
          <button
            type="button"
            className={`mt-6 ${role.active ? 'button-primary' : 'button-soft opacity-60'} w-full`}
            disabled={!role.active}
            onClick={() => role.active && onSelectRole(role.id)}
          >
            {role.active ? `Register as ${role.title}` : 'Coming soon'}
          </button>
        </div>
      ))}
    </section>
  </div>
)

export default RoleSelectionScreen

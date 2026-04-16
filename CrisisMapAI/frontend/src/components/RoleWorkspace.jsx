import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardData, getProfile, getVictimIncidents } from '../api/client'
import VoiceSOSButton from './VoiceSOSButton'

const sosDraftPrefix = 'crisismap_sos_draft'

const RoleWorkspace = ({ session }) => {
  const [profile, setProfile] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [victimIncidents, setVictimIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setError('')
        const requests = [getProfile(session.role, session.subject_id)]
        if (session.role === 'victim') requests.push(getVictimIncidents(session.subject_id))
        if (session.role === 'organization') requests.push(getDashboardData(session.subject_id))
        const results = await Promise.all(requests)
        const profileResult = results[0]
        setProfile(profileResult)
        if (session.role === 'victim') {
          setVictimIncidents(results[1] || [])
          setDashboard(null)
        } else if (session.role === 'organization') {
          setDashboard(results[1] || null)
        } else {
          setDashboard(null)
        }
      } catch (error) {
        console.error('Workspace load failed:', error)
        setError(error?.response?.data?.detail || 'Unable to load your workspace right now.')
        setProfile(null)
        setDashboard(null)
        setVictimIncidents([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

  const profileData = profile?.profile_data || {}
  const savedSosDraft = useMemo(() => {
    if (session.role !== 'victim') return null
    try {
      const raw = window.localStorage.getItem(`${sosDraftPrefix}:${session.subject_id}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [session])

  const view = useMemo(() => {
    if (session.role === 'victim') {
      const identity = profileData.identity || {}
      const household = profileData.household_profile || {}
      const medical = profileData.medical_profile || {}
      const location = profileData.location_profile || {}
      return {
        title: `Welcome back, ${identity.full_name || 'there'}`,
        subtitle: 'Your workspace keeps emergency readiness simple. Profile defaults from your registration are ready to support SOS intake when needed.',
        primaryAction: { label: 'Open Emergency SOS', to: '/sos', style: 'button-danger' },
        secondaryAction: { label: 'Edit Profile', to: '/account', style: 'button-soft' },
        summary: [
          ['Home zone', location.home_zone || 'Not set'],
          ['Household size', household.household_size ?? 'Not set'],
          ['Preferred language', identity.preferred_language || 'Not set'],
          ['Oxygen support', medical.home_oxygen_device || medical.conditions?.requires_oxygen_or_respiratory_support ? 'Enabled' : 'Off'],
        ],
        notes: [
          'Your registered profile can auto-fill people count, oxygen need, elderly involvement, and preferred language during SOS submission.',
          'Keep your household and medical data current so responders receive accurate context before arrival.',
        ],
      }
    }

    if (session.role === 'responder') {
      const identity = profileData.identity || {}
      const capability = profileData.capability_profile || {}
      const coverage = profileData.zone_coverage || {}
      return {
        title: `Welcome back, ${identity.full_name || 'responder'}`,
        subtitle: 'Your workspace is centered on assignment readiness. Capability, coverage, and certification data shape how the system matches you to incidents.',
        primaryAction: { label: 'Open Assignment Console', to: '/responder', style: 'button-primary' },
        secondaryAction: { label: 'Edit Profile', to: '/account', style: 'button-soft' },
        readinessScore: Math.min(100, (
          (capability.responder_type ? 25 : 0) +
          ((capability.capabilities?.length || 0) > 0 ? 25 : 0) +
          ((coverage.coverage_zones?.length || 0) > 0 ? 25 : 0) +
          (coverage.max_travel_radius_km ? 15 : 0) +
          ((profileData.availability || {}).status ? 10 : 0)
        )),
        summary: [
          ['Responder type', capability.responder_type || 'Not set'],
          ['Capabilities listed', capability.capabilities?.length ?? 0],
          ['Primary zone', coverage.primary_station_zone || 'Not set'],
          ['Travel radius', coverage.max_travel_radius_km ? `${coverage.max_travel_radius_km} km` : 'Not set'],
        ],
        notes: [
          'Expired certifications remain stored for audit, but they are excluded from active capability matching when required.',
          'Coverage zones and operating-condition preferences affect assignment penalties and deployment preference.',
        ],
      }
    }

    const identity = profileData.identity || {}
    const coverage = profileData.coverage || {}
    const inventory = profileData.equipment_inventory || {}
    return {
      title: `${identity.organization_name || profile?.name || 'Organization'} workspace`,
      subtitle: 'Your workspace focuses on operational readiness: verified resources, responder linkage, coverage, and live response conditions.',
      primaryAction: { label: 'Open Coordinator Console', to: '/coordinator', style: 'button-primary' },
      secondaryAction: { label: 'Edit Profile', to: '/account', style: 'button-soft' },
      readinessScore: Math.min(100, (
        (profile?.verification_status === 'verified' ? 30 : 0) +
        ((coverage.coverage_zones?.length || 0) > 0 ? 20 : 0) +
        ((inventory.vehicles?.length || 0) > 0 ? 15 : 0) +
        ((inventory.shelters?.length || 0) > 0 ? 15 : 0) +
        ((dashboard?.responders?.length || 0) > 0 ? 20 : 0)
      )),
      summary: [
        ['Verification', profile?.verification_status || 'Pending'],
        ['Coverage zones', coverage.coverage_zones?.length ?? 0],
        ['Vehicles', inventory.vehicles?.length ?? 0],
        ['Shelters', inventory.shelters?.length ?? 0],
      ],
      notes: [
        'Vehicles and shelters become active resources only after organization verification is complete.',
        'Coverage and inventory data feed operational views and responder deployment decisions.',
      ],
    }
  }, [profile, profileData, session])

  if (loading) return <div className="panel text-center py-16 text-slate-500">Loading your workspace...</div>
  if (error) {
    return (
      <div className="workspace-page">
        <section className="workspace-page-hero">
          <p className="workspace-kicker">{session.role} workspace</p>
          <h1 className="workspace-page-title">Workspace Unavailable</h1>
          <p className="workspace-page-copy">{error}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/account" className="button-primary min-w-[220px]">Review Account Session</Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-hero">
        <div className="workspace-hero-grid">
          <div>
            <p className="workspace-kicker">{session.role} workspace</p>
            <h1 className="workspace-page-title">{view.title}</h1>
            <p className="workspace-page-copy">{view.subtitle}</p>
          </div>
          <div className="workspace-hero-actions">
            <Link to={view.primaryAction.to} className={`${view.primaryAction.style} min-w-[220px]`}>
              {view.primaryAction.label}
            </Link>
            <Link to={view.secondaryAction.to} className={`${view.secondaryAction.style} min-w-[220px]`}>
              {view.secondaryAction.label}
            </Link>
            {session.role === 'organization' && <Link to="/overview" className="button-soft min-w-[220px]">View Overview</Link>}
            {session.role === 'victim' && (
              <div className="workspace-voice-wrap">
                <VoiceSOSButton session={session} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="workspace-summary-grid">
        {typeof view.readinessScore === 'number' && (
          <div className="workspace-summary-card">
            <p className="metric-label">{session.role === 'organization' ? 'Org readiness' : 'Readiness score'}</p>
            <p className="workspace-summary-value text-indigo-600">{view.readinessScore}/100</p>
          </div>
        )}
        {view.summary.map(([label, value]) => (
          <div key={label} className="workspace-summary-card">
            <p className="metric-label">{label}</p>
            <p className="workspace-summary-value">{value}</p>
          </div>
        ))}
      </section>

      <section className="workspace-content-grid">
        {session.role === 'organization' && dashboard && (
          <section className="workspace-info-block workspace-span-main">
            <h2 className="workspace-section-title">Live operations snapshot</h2>
            <div className="workspace-summary-grid mt-6">
              <div className="workspace-summary-card">
                <p className="metric-label">Active incidents</p>
                <p className="workspace-summary-value text-rose-600">{dashboard.activeIncidents || 0}</p>
              </div>
              <div className="workspace-summary-card">
                <p className="metric-label">Responders ready</p>
                <p className="workspace-summary-value text-emerald-600">{dashboard.availableResponders || 0}</p>
              </div>
              <div className="workspace-summary-card">
                <p className="metric-label">Hospital beds</p>
                <p className="workspace-summary-value text-sky-600">{dashboard.availableBeds || 0}</p>
              </div>
              <div className="workspace-summary-card">
                <p className="metric-label">Shelter capacity</p>
                <p className="workspace-summary-value text-violet-600">{dashboard.availableShelterCapacity || 0}</p>
              </div>
            </div>
          </section>
        )}

        {session.role === 'victim' && (
          <section className="workspace-info-block workspace-span-main">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="workspace-section-title">Your SOS requests</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Every submitted SOS is stored with its live status, responder assignment, and algorithm outputs so you can reopen and track it any time.
                </p>
              </div>
              <Link to="/sos" className="button-danger">Submit New SOS</Link>
            </div>

            {savedSosDraft?.formData && (
              <div className="workspace-note-card mt-6 border border-amber-200 bg-amber-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Saved SOS draft</p>
                    <p className="mt-2 text-sm font-semibold text-amber-950">
                      {savedSosDraft.formData.disasterType || 'Emergency'} in {savedSosDraft.formData.zone || 'location pending'}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Last saved {savedSosDraft.updatedAt ? new Date(savedSosDraft.updatedAt).toLocaleString() : 'recently'}
                    </p>
                  </div>
                  <Link to="/sos" className="button-soft border border-amber-200 bg-white text-amber-900 hover:bg-amber-100">
                    Resume Draft
                  </Link>
                </div>
              </div>
            )}

            {victimIncidents.length > 0 ? (
              <div className="workspace-incidents-grid mt-6">
                {[...victimIncidents]
                  .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                  .map((incident) => (
                  <div key={incident.sos_id || incident.id} className="workspace-summary-card">
                    <p className="metric-label">{incident.disaster_type || 'Emergency request'}</p>
                    <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                      {incident.zone || 'Location pending'}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Status: <span className="font-semibold text-slate-700">{incident.status || 'received'}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      ETA: <span className="font-semibold text-slate-700">{incident.eta || 'Pending'}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Submitted: <span className="font-semibold text-slate-700">{incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Tracked in history'}</span>
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                        SOS #{incident.sos_id || incident.id}
                      </span>
                      <Link to={`/victim/${incident.sos_id || incident.id}?victimId=${session.subject_id}`} className="button-soft">
                        Track request
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="workspace-note-card mt-6">
                <p className="text-sm leading-7 text-slate-600">
                  No SOS requests have been submitted from this victim profile yet.
                </p>
              </div>
            )}
          </section>
        )}

        <section className="workspace-side-panel">
          <h2 className="workspace-section-title workspace-section-title-sm">Quick Guidance</h2>
          <div className="workspace-notes workspace-notes-compact mt-5">
            {view.notes.map((note) => (
              <div key={note} className="workspace-note-card">
                <p className="text-sm leading-7 text-slate-600">{note}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}

export default RoleWorkspace

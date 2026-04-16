import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfile } from '../api/client'
import LoginHub from './LoginHub'

const sessionKey = 'crisismap_session'

const availabilityTone = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'available') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (normalized === 'busy' || normalized === 'assigned') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

const deriveProfileSignals = (role, profile, profileData) => {
  if (role === 'victim') {
    const household = profileData.household_profile || {}
    const medical = profileData.medical_profile || {}
    return [
      medical.home_oxygen_device || medical.conditions?.requires_oxygen_or_respiratory_support ? 'Oxygen dependent' : null,
      household.elderly_members ? `Elderly household (${household.elderly_members})` : null,
      household.children_under_12 ? `Children present (${household.children_under_12})` : null,
      household.mobility_limited_members ? `Mobility support needed (${household.mobility_limited_members})` : null,
      profile?.home_zone_id || profileData.location_profile?.home_zone ? 'Location defaults ready' : null,
    ].filter(Boolean)
  }

  if (role === 'responder') {
    const capabilities = profileData.capability_profile || {}
    const coverage = profileData.zone_coverage || {}
    const certifications = capabilities.certifications || []
    const today = new Date().toISOString().slice(0, 10)
    const expiredCount = certifications.filter((cert) => cert.expiry_date && cert.expiry_date < today).length
    return [
      profile?.organization_name ? `Linked to ${profile.organization_name}` : 'Organization not linked',
      capabilities.capabilities?.includes('Oxygen Administration') ? 'Oxygen-capable responder' : null,
      profileData.conditions?.flooded_conditions || profileData.availability?.flooded_conditions ? 'Flood-capable' : null,
      profileData.conditions?.fire_conditions || profileData.availability?.fire_conditions ? 'Fire-capable' : null,
      coverage.coverage_zones?.length ? `${coverage.coverage_zones.length} coverage zones` : 'Coverage incomplete',
      expiredCount ? `${expiredCount} certification${expiredCount === 1 ? '' : 's'} expired` : 'Certifications current',
    ].filter(Boolean)
  }

  const coverage = profileData.coverage || {}
  const inventory = profileData.equipment_inventory || {}
  const responders = profile?.responders || []
  const availableResponders = responders.filter((responder) => responder.availability_status === 'available').length
  return [
    profile?.verification_status === 'verified' ? 'Verified organization' : 'Verification pending',
    profile?.organization_code ? 'Organization code active' : null,
    coverage.coverage_zones?.length ? `${coverage.coverage_zones.length} coverage zones active` : 'Coverage incomplete',
    responders.length ? `${responders.length} responders linked` : 'No responders linked',
    responders.length ? `${availableResponders} responders available` : null,
    inventory.shelters?.length ? `${inventory.shelters.length} shelters listed` : 'No shelters listed',
    inventory.vehicles?.length ? `${inventory.vehicles.length} vehicles listed` : 'No vehicles listed',
  ].filter(Boolean)
}

const deriveReadiness = (role, profile, profileData) => {
  if (role === 'responder') {
    const capability = profileData.capability_profile || {}
    const coverage = profileData.zone_coverage || {}
    const availability = profileData.availability || {}
    const certifications = capability.certifications || []
    const today = new Date().toISOString().slice(0, 10)
    const activeCertifications = certifications.filter((cert) => !cert.expiry_date || cert.expiry_date >= today).length
    let score = 0
    if (capability.responder_type) score += 20
    if ((capability.capabilities || []).length) score += 20
    if ((coverage.coverage_zones || []).length) score += 20
    if (coverage.max_travel_radius_km) score += 10
    if (availability.status) score += 15
    if (activeCertifications > 0) score += 15
    return {
      label: 'Responder readiness',
      score,
      notes: [
        `${(capability.capabilities || []).length} capabilities listed`,
        `${(coverage.coverage_zones || []).length} coverage zones`,
        `${activeCertifications} active certification${activeCertifications === 1 ? '' : 's'}`,
      ],
    }
  }

  if (role === 'organization') {
    const coverage = profileData.coverage || {}
    const inventory = profileData.equipment_inventory || {}
    const responders = profile?.responders || []
    let score = 0
    if (profile?.verification_status === 'verified') score += 25
    if ((coverage.coverage_zones || []).length) score += 20
    if ((inventory.vehicles || []).length) score += 15
    if ((inventory.shelters || []).length) score += 15
    if (responders.length) score += 15
    if (responders.some((responder) => responder.availability_status === 'available')) score += 10
    return {
      label: 'Organization readiness',
      score,
      notes: [
        `${responders.length} linked responders`,
        `${(inventory.vehicles || []).length} vehicles`,
        `${(inventory.shelters || []).length} shelters`,
      ],
    }
  }

  return null
}

const summaryRowsForRole = (role, profile, profileData) => {
  if (role === 'victim') {
    const identity = profileData.identity || {}
    const location = profileData.location_profile || {}
    const household = profileData.household_profile || {}
    const medical = profileData.medical_profile || {}
    return [
      ['Full name', identity.full_name || profile?.full_name || 'Not available'],
      ['Phone', identity.phone || profile?.phone || 'Not available'],
      ['Preferred language', identity.preferred_language || profile?.preferred_language || 'Not available'],
      ['Home zone', location.home_zone || profile?.home_zone_id || 'Not set'],
      ['Work zone', location.work_zone || profile?.work_zone_id || 'Not set'],
      ['Frequent zones', (location.frequent_zones || profile?.frequent_zone_ids || []).join(', ') || 'Not set'],
      ['Household size', household.household_size ?? 'Not set'],
      ['Emergency support flags', [
        medical.home_oxygen_device || medical.conditions?.requires_oxygen_or_respiratory_support ? 'Oxygen support' : null,
        household.elderly_members ? `${household.elderly_members} elderly` : null,
        household.children_under_12 ? `${household.children_under_12} children` : null,
        household.mobility_limited_members ? `${household.mobility_limited_members} mobility-limited` : null,
      ].filter(Boolean).join(' • ') || 'No critical support flags'],
    ]
  }

  if (role === 'responder') {
    const identity = profileData.identity || {}
    const capabilities = profileData.capability_profile || {}
    const coverage = profileData.zone_coverage || {}
    const availability = profileData.availability || {}
    return [
      ['Full name', identity.full_name || profile?.full_name || 'Not available'],
      ['Organization', profile?.organization_name || profileData.organization?.organization_name || identity.organization_name || 'Not linked'],
      ['Organization code', profile?.organization_code || profileData.organization?.organization_code || 'Not available'],
      ['Employee ID', identity.employee_id || profile?.employee_id || 'Not available'],
      ['Responder type', capabilities.responder_type || 'Not set'],
      ['Role title', identity.role_title || 'Not set'],
      ['Capabilities', (capabilities.capabilities || []).join(', ') || 'Not set'],
      ['Primary station', coverage.primary_station_zone || 'Not set'],
      ['Coverage zones', (coverage.coverage_zones || []).join(', ') || 'Not set'],
      ['Availability', availability.status || profile?.status || 'Not set'],
      ['Languages', (availability.languages || []).join(', ') || 'Not set'],
    ]
  }

  const identity = profileData.identity || {}
  const coverage = profileData.coverage || {}
  const inventory = profileData.equipment_inventory || {}
  return [
    ['Organization name', identity.organization_name || profile?.name || 'Not available'],
    ['Organization code', profile?.organization_code || identity.organization_code || 'Not available'],
    ['Verification', profile?.verification_status || 'Pending'],
    ['Registration number', identity.registration_number || 'Not set'],
    ['Primary contact', identity.primary_contact_name || 'Not set'],
    ['Primary phone', identity.primary_contact_phone || 'Not set'],
    ['Primary email', identity.primary_contact_email || 'Not set'],
    ['Headquarters zone', coverage.headquarters_zone || 'Not set'],
    ['Coverage zones', (coverage.coverage_zones || []).join(', ') || 'Not set'],
    ['Resources', `${inventory.vehicles?.length || 0} vehicles • ${inventory.shelters?.length || 0} shelters`],
  ]
}

const ProfileEditorHub = ({ session: externalSession, onLoggedIn, onLoggedOut }) => {
  const [session, setSession] = useState(() => {
    if (externalSession) return externalSession
    const raw = window.localStorage.getItem(sessionKey)
    return raw ? JSON.parse(raw) : null
  })
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  const clearSession = () => {
    window.localStorage.removeItem(sessionKey)
    setSession(null)
    setProfile(null)
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

  const profileData = profile?.profile_data || {}
  const summaryRows = useMemo(
    () => summaryRowsForRole(session?.role, profile, profileData),
    [profile, profileData, session]
  )
  const profileSignals = useMemo(
    () => deriveProfileSignals(session?.role, profile, profileData),
    [profile, profileData, session]
  )
  const readiness = useMemo(
    () => deriveReadiness(session?.role, profile, profileData),
    [profile, profileData, session]
  )
  const organizationResponders = useMemo(
    () => (session?.role === 'organization' ? (profile?.responders || []) : []),
    [profile, session]
  )

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
            <p className="section-kicker">Profile</p>
            <h2 className="panel-title mt-2 capitalize">{session.role} account</h2>
            <p className="panel-subtitle mt-2">
              Your saved profile is shown here in a readable format. Registration details continue to power SOS defaults, routing context, and capability matching.
            </p>
          </div>
          <button type="button" className="button-soft" onClick={logout}>Log out</button>
        </div>
      </section>

      <section className="panel">
        <div className="mb-6 grid gap-3 md:grid-cols-3">
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

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        )}

        {profile ? (
          <>
            {(readiness || profileSignals.length > 0) && (
              <div className="mb-6 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
                {readiness && (
                  <div className="rounded-[20px] border border-indigo-100 bg-indigo-50 px-5 py-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">{readiness.label}</p>
                    <p className="mt-3 text-4xl font-black text-slate-950">{readiness.score}<span className="text-lg text-slate-500">/100</span></p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${readiness.score}%` }} />
                    </div>
                    <div className="mt-4 space-y-1 text-sm text-slate-600">
                      {readiness.notes.map((note) => <p key={note}>{note}</p>)}
                    </div>
                  </div>
                )}
                {profileSignals.length > 0 && (
                  <div className="rounded-[20px] border border-amber-100 bg-amber-50 px-5 py-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Live risk flags</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {profileSignals.map((signal) => (
                        <span key={signal} className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-amber-900">
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {summaryRows.map(([label, value]) => (
                <div key={label} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {session.role === 'organization' && (
              <div className="mt-6 rounded-[20px] border border-slate-200 bg-white px-5 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Responder roster</p>
                    <p className="mt-2 text-lg font-black text-slate-950">
                      {organizationResponders.length} linked responder{organizationResponders.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {organizationResponders.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {organizationResponders.map((responder) => (
                      <div key={responder.id || responder.responder_id || responder.employee_id} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-950">{responder.full_name || 'Unnamed responder'}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              {responder.responder_type || responder.role_title || 'Responder'}
                            </p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${availabilityTone(responder.availability_status || responder.status)}`}>
                            {(responder.availability_status || responder.status || 'unknown').replace('_', ' ')}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          <p><span className="font-semibold text-slate-800">Employee ID:</span> {responder.employee_id || 'Not set'}</p>
                          <p><span className="font-semibold text-slate-800">Responder ID:</span> {responder.responder_id || 'Not set'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[18px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    No responders are linked to this organization yet.
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Loading profile details...
          </div>
        )}

        <div className="mt-6 rounded-[20px] border border-sky-100 bg-sky-50 px-5 py-4 text-sm leading-7 text-sky-900">
          Registration details are no longer shown as raw JSON here. If you need to revise structured profile fields, use the role-specific registration/update flow and then return here to verify the saved values.
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/workspace" className="button-soft">Back to Workspace</Link>
          {session.role === 'victim' && <Link to="/sos" className="button-danger">Open Emergency SOS</Link>}
        </div>
      </section>
    </div>
  )
}

export default ProfileEditorHub

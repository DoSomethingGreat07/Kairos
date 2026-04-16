import React, { useEffect, useState } from 'react'

import { SOCKET_BASE_URL, getProfile, getResponderIncidents, updateResponderAvailability } from '../api/client'

const severityColor = (severity) => {
  const s = String(severity).toLowerCase()
  if (s.includes('critical')) return 'text-rose-700 bg-rose-100 border-rose-200'
  if (s.includes('high')) return 'text-orange-700 bg-orange-100 border-orange-200'
  if (s.includes('medium')) return 'text-amber-700 bg-amber-100 border-amber-200'
  return 'text-emerald-700 bg-emerald-100 border-emerald-200'
}

const ResponderPanel = () => {
  const [assignments, setAssignments] = useState([])
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [availabilityStatus, setAvailabilityStatus] = useState('available')
  const [availabilitySaving, setAvailabilitySaving] = useState(false)
  const [responderId] = useState(() => {
    try {
      const session = JSON.parse(window.localStorage.getItem('crisismap_session') || 'null')
      return session?.role === 'responder' ? session.subject_id : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    let isMounted = true
    const refreshAssignments = async () => {
      if (!responderId) {
        if (isMounted) {
          setAssignments([])
          setSelectedAssignment(null)
        }
        return
      }
      try {
        const data = await getResponderIncidents(responderId)
        if (!isMounted) return
        setAssignments(data)
        setSelectedAssignment((current) => {
          if (current?.id) {
            return data.find((assignment) => assignment.id === current.id) || data[0] || null
          }
          return data[0] || null
        })
      } catch (error) {
        console.error('Error fetching responder assignments:', error)
      }
    }

    const loadResponderProfile = async () => {
      if (!responderId) return
      try {
        const profile = await getProfile('responder', responderId)
        setAvailabilityStatus(profile?.profile_data?.availability?.status || profile?.availability_status || profile?.status || 'available')
      } catch (error) {
        console.error('Error fetching responder profile:', error)
      }
    }

    refreshAssignments()
    loadResponderProfile()

    const wsUrl = SOCKET_BASE_URL.replace(/^http/, 'ws') + '/ws'
    const socket = new WebSocket(wsUrl)

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'assignment_update' || payload.type === 'incident_update') {
          refreshAssignments()
        }
      } catch (err) {}
    }

    return () => {
      isMounted = false
      socket.close()
    }
  }, [responderId])

  const renderActiveAssignment = () => {
    if (!selectedAssignment) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 text-slate-500">
          <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No active assignment selected. Stand by.</p>
        </div>
      )
    }

    const {
      id,
      sos_id,
      disaster_type,
      incident_type,
      status,
      eta,
      people_count,
      algorithm_results = {},
      messages = {},
      case_trace = {}
    } = selectedAssignment

    const bayesian = algorithm_results.bayesian_severity || {}
    const dijkstra = algorithm_results.dijkstra || {}
    const yenRoutes = algorithm_results.yen_routes || []
    const hungarian = algorithm_results.hungarian_assignment || {}
    const volunteers = algorithm_results.gale_shapley || []
    const assignmentReasons = [
      hungarian.rationale || hungarian.explanation || null,
      hungarian.responder_type ? `${hungarian.responder_type} fit selected for this incident.` : null,
      dijkstra.destination?.reason || null,
      eta ? `Projected scene ETA: ${eta}.` : null,
    ].filter(Boolean).slice(0, 4)

    const displaySeverity = bayesian.inferred_severity || selectedAssignment.severity || 'Normal'
    const displayDisaster = disaster_type || incident_type || 'Emergency'
    const instructions = messages.responder_instructions || 'Proceed to location safely. Assess scene upon arrival.'
    
    return (
      <div className="space-y-6">
        {/* 1. INCIDENT SUMMARY */}
        <section className="rounded-[24px] bg-slate-900 p-6 text-white shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Target Incident — #{sos_id || id}</p>
              <h2 className="mt-2 text-3xl font-black capitalize">{displayDisaster}</h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${severityColor(displaySeverity)}`}>
              {displaySeverity} Severity
            </span>
          </div>
          
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="bg-white/10 px-4 py-2 rounded-xl">
              <span className="text-xs text-slate-300 block mb-1 uppercase tracking-wide font-bold">Affected</span>
              <span className="text-lg font-bold">{people_count || 'Unknown'} people</span>
            </div>
            {case_trace.critical_needs && (
              <div className="bg-rose-500/20 px-4 py-2 rounded-xl max-w-sm">
                <span className="text-xs text-rose-200 block mb-1 uppercase tracking-wide font-bold">Special Needs Detected</span>
                <span className="text-sm font-semibold">{case_trace.critical_needs}</span>
              </div>
            )}
          </div>
        </section>

        {/* 2. ASSIGNMENT DETAILS & 4. DESTINATION */}
        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-[24px] bg-white p-5 border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Unit Assignment</h3>
            <p className="mt-2 text-xl font-bold text-slate-900">{selectedAssignment.responder || 'Your Unit'}</p>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Assigned Type:</span> {hungarian.responder_type || 'Standard Responder'}</p>
              <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Dispatch Mode:</span> <span className="capitalize">{algorithm_results.dispatch_mode || 'standard'}</span></p>
              <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Status:</span> <span className="capitalize">{status || 'Dispatched'}</span></p>
            </div>
            {assignmentReasons.length > 0 && (
              <div className="mt-4 rounded-[18px] border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Why this mission?</p>
                <div className="mt-3 space-y-2">
                  {assignmentReasons.map((reason) => (
                    <p key={reason} className="text-sm font-semibold text-slate-700">{reason}</p>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[24px] bg-white p-5 border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Destination Objective</h3>
            <p className="mt-2 text-xl font-bold text-slate-900">{dijkstra.destination?.name || selectedAssignment.destination || 'Scene Location'}</p>
            <div className="mt-3 space-y-1">
              {dijkstra.destination?.type && (
                 <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Facility Type:</span> <span className="capitalize">{dijkstra.destination.type}</span></p>
              )}
              {dijkstra.destination?.reason && (
                 <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Algorithm Reason:</span> {dijkstra.destination.reason}</p>
              )}
            </div>
          </section>
        </div>

        {/* 3. ROUTE & ETA */}
        <section className="rounded-[24px] bg-sky-50 border border-sky-100 p-5">
           <h3 className="text-xs font-bold uppercase tracking-wide text-sky-600 mb-4">Route Intelligence</h3>
           <div className="grid md:grid-cols-3 gap-6">
              <div>
                 <p className="text-xs uppercase font-bold text-sky-800 mb-1">Target ETA</p>
                 <p className="text-2xl font-black text-slate-900">{eta || 'TBD'}</p>
              </div>
              <div className="col-span-2">
                 <p className="text-xs uppercase font-bold text-sky-800 mb-1">Dijkstra Routing</p>
                 {dijkstra.excluded_edges?.length > 0 ? (
                    <p className="text-sm font-semibold text-rose-700 bg-rose-100 px-3 py-1.5 rounded-lg inline-block">
                      Warning: Blocked roads bypassed in generated route.
                    </p>
                 ) : (
                    <p className="text-sm text-sky-900">Optimal primary route selected. No detected blocks.</p>
                 )}
                 {yenRoutes.length > 0 && (
                   <p className="mt-2 text-sm text-sky-700">Backup routes calculated (Yen's K-Shortest): {yenRoutes.length} available.</p>
                 )}
              </div>
           </div>
        </section>

        {/* 5. OPERATIONAL INSTRUCTIONS & 6. SUPPORT COORDINATION */}
        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-[24px] bg-slate-50 border border-slate-200 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Unit Instructions</h3>
            <ul className="space-y-2 text-sm font-medium text-slate-800">
               {instructions.split(/\n|\.\s+/).filter(Boolean).map((inst, i) => (
                 <li key={i} className="flex gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>{inst.replace(/\.$/, '')}</span>
                 </li>
               ))}
            </ul>
          </section>

          {volunteers.length > 0 && (
            <section className="rounded-[24px] bg-emerald-50 border border-emerald-100 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-600 mb-3">Volunteer Support Assigned</h3>
              <div className="space-y-3">
                {volunteers.map((vol, idx) => (
                  <div key={idx} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-emerald-100">
                    <div className="h-8 w-8 bg-emerald-200 text-emerald-800 rounded-full flex items-center justify-center font-bold text-xs">{vol.volunteer_name?.charAt(0) || 'V'}</div>
                    <div>
                      <p className="text-sm font-bold text-emerald-900">{vol.volunteer_name}</p>
                      <p className="text-xs font-medium text-emerald-700">Arriving in {vol.estimated_arrival}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 7. ACTION CONTROLS */}
        <section className="pt-4 grid grid-cols-2 sm:flex sm:flex-wrap gap-3 border-t border-slate-200">
           <button onClick={() => alert('Mission Accepted')} className="flex-1 min-w-[140px] bg-slate-900 hover:bg-slate-800 text-white rounded-[16px] py-3 text-sm font-bold uppercase tracking-wide">Accept Mission</button>
           <button onClick={() => alert('Marked En Route')} className="flex-1 min-w-[140px] bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-[16px] py-3 text-sm font-bold uppercase tracking-wide border border-blue-200">En Route</button>
           <button onClick={() => alert('Marked Arrived')} className="flex-1 min-w-[140px] bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-[16px] py-3 text-sm font-bold uppercase tracking-wide border border-emerald-200">Arrived</button>
           <button onClick={() => alert('Backup Requested')} className="flex-1 min-w-[140px] bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-[16px] py-3 text-sm font-bold uppercase tracking-wide border border-rose-200">Req Backup</button>
           <button onClick={() => alert('Mission Completed')} className="flex-1 min-w-[140px] bg-white hover:bg-slate-50 text-slate-800 rounded-[16px] py-3 text-sm font-bold uppercase tracking-wide border border-slate-300">Complete</button>
        </section>

      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Availability control</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Responder availability toggle</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {['available', 'busy', 'off_duty'].map((status) => (
              <button
                key={status}
                type="button"
                disabled={availabilitySaving}
                onClick={async () => {
                  if (!responderId) return
                  try {
                    setAvailabilitySaving(true)
                    await updateResponderAvailability(responderId, status)
                    setAvailabilityStatus(status)
                  } catch (error) {
                    console.error('Unable to update responder availability:', error)
                  } finally {
                    setAvailabilitySaving(false)
                  }
                }}
                className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition ${
                  availabilityStatus === status
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        
        {/* ASSIGNMENT QUEUE */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-2 text-slate-800">Dispatch Queue</h2>
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const bayesian = assignment.algorithm_results?.bayesian_severity || {}
              const displaySeverity = bayesian.inferred_severity || assignment.severity || 'Normal'
              
              return (
                <button
                  key={assignment.id}
                  type="button"
                  className={`w-full rounded-[20px] border p-4 text-left transition text-sm ${
                    selectedAssignment?.id === assignment.id
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedAssignment(assignment)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-slate-900 capitalize">{assignment.incident_type || assignment.disaster_type || 'Emergency'}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityColor(displaySeverity)}`}>
                      {displaySeverity}
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium">{assignment.zone}</p>
                  <p className="text-slate-500 mt-1 text-xs">ETA: {assignment.eta || 'TBD'}</p>
                </button>
              )
            })}
            {assignments.length === 0 && (
              <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
                You are currently unassigned.
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE ASSIGNMENT PANEL */}
        <div>
           {renderActiveAssignment()}
        </div>
      </section>
    </div>
  )
}

export default ResponderPanel

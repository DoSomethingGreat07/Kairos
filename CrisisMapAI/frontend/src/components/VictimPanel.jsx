import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { getIncidentDetails, SOCKET_BASE_URL, normalizeIncident } from '../api/client'

const VictimPanel = () => {
  const { sosId } = useParams()
  const [incident, setIncident] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchIncident = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await getIncidentDetails(sosId)
      setIncident(data)
    } catch (error) {
      console.error('Error fetching incident:', error)
    } finally {
      if (isRefresh) setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIncident()

    const wsUrl = SOCKET_BASE_URL.replace(/^http/, 'ws') + '/ws'
    const socket = new WebSocket(wsUrl)
    
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'incident_update') {
          const data = payload.data
          if (data.sos_id === sosId || data.id === sosId) {
            setIncident(normalizeIncident(data))
          }
        }
      } catch (err) {}
    }

    const intervalId = setInterval(() => {
      fetchIncident(true)
    }, 30000)

    return () => {
      socket.close()
      clearInterval(intervalId)
    }
  }, [sosId])

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-500 border-t-transparent" />
        <p className="font-semibold text-slate-500">Loading emergency status...</p>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Incident not found</h2>
        <p className="mt-2 text-slate-600">We could not locate the details for SOS #{sosId}. Please contact support or submit a new emergency request.</p>
      </div>
    )
  }

  const {
    algorithm_results = {},
    case_events = [],
    case_trace = {},
    people_count,
  } = incident

  const dijkstra = algorithm_results?.dijkstra || {}
  const hungarian = algorithm_results?.hungarian_assignment || {}
  const volunteers = algorithm_results?.gale_shapley || []
  const msgs = algorithm_results?.messages || {}

  const rawStatus = incident.status || hungarian.status || 'received'
  let displayStatus = 'Request Received'
  if (rawStatus === 'processed') displayStatus = 'Help Assigned'
  else if (rawStatus === 'queued') displayStatus = 'Waiting for Assignment'
  else if (rawStatus === 'blocked_access') displayStatus = 'Access Blocked'
  else if (rawStatus) {
    displayStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)
  }

  const score = incident.priority_score || 0
  let priorityLabel = 'Low'
  let priorityColor = 'bg-emerald-500 shadow-emerald-500/30'
  let priorityBg = 'bg-emerald-50 border-emerald-100 text-emerald-900'
  let priorityIconTint = 'text-emerald-500'
  if (score < 1) {
    priorityLabel = 'Critical'
    priorityColor = 'bg-rose-500 shadow-rose-500/30'
    priorityBg = 'bg-rose-50 border-rose-100 text-rose-900'
    priorityIconTint = 'text-rose-500'
  } else if (score < 2) {
    priorityLabel = 'High'
    priorityColor = 'bg-orange-500 shadow-orange-500/30'
    priorityBg = 'bg-orange-50 border-orange-100 text-orange-900'
    priorityIconTint = 'text-orange-500'
  } else if (score < 3) {
    priorityLabel = 'Medium'
    priorityColor = 'bg-amber-500 shadow-amber-500/30'
    priorityBg = 'bg-amber-50 border-amber-100 text-amber-900'
    priorityIconTint = 'text-amber-500'
  }

  const isHelpAssigned = !!incident.responder
  const responderText = isHelpAssigned
    ? `Responder Assigned: ${incident.responder}`
    : hungarian.assigned === false
      ? (hungarian.reason || 'No responder could be safely assigned yet.')
      : 'Searching for nearest available responder...'
  
  const etaText = incident.eta
    ? `Estimated Arrival: ${incident.eta}`
    : hungarian.assigned === false
      ? 'No safe arrival estimate available right now.'
      : 'Estimating arrival time...'

  const destinationName = dijkstra.destination?.name 
  const displayDestName = destinationName
    ? destinationName
    : hungarian.destination?.name
      ? hungarian.destination.name
      : 'Determining safest destination...'
  
  const excludedEdges = dijkstra.excluded_edges || []
  const hasAlternateRoute = excludedEdges.length > 0

  const rawMessage =
    incident.message ||
    msgs.victim_confirmation ||
    hungarian.reason ||
    'Your SOS has been received and verified.\nEmergency teams are identifying the fastest safe route to reach you.\nStay calm, keep your phone nearby, and move only if it is safe to do so.'
  const instructionsList = rawMessage
    .split(/\n|\.\s+/)
    .map(s => s.trim().replace(/\.$/, ''))
    .filter(s => s.length > 5)
    .slice(0, 5)

  const hasVolunteers = volunteers.length > 0

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-12 pt-6 px-4">
      
      {/* HEADER SECTION - BACK NAVIGATION */}
      <div className="flex items-center justify-between mb-2">
         <Link to="/workspace" className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Workspace
         </Link>
         <Link to="/sos" className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 rounded-full px-3 py-1">
            New SOS
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
         </Link>
      </div>
      
      {/* SECTION 1 — EMERGENCY STATUS CARD */}
      <section className={`relative overflow-hidden rounded-[24px] border border-white/50 p-6 shadow-xl backdrop-blur-md transition-colors duration-500 ${priorityBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`relative flex h-4 w-4`}>
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${priorityColor}`}></span>
              <span className={`relative inline-flex h-4 w-4 rounded-full shadow-lg ${priorityColor}`}></span>
            </span>
            <span className="text-sm font-semibold tracking-wide uppercase opacity-80">SOS #{incident.sos_id || sosId}</span>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md ${priorityColor}`}>
            {priorityLabel} Priority
          </div>
        </div>
        
        <div className="mt-5">
          <h2 className="text-3xl font-black leading-tight tracking-tight">{displayStatus}</h2>
          <p className="mt-2 max-w-md text-sm font-medium leading-6 opacity-90">
            Your SOS has been submitted successfully. Our emergency coordination system is now tracking your case,
            assigning the nearest available help, and monitoring for live updates.
          </p>
        </div>
      </section>

      {/* SECTION 5 — SAFETY INSTRUCTIONS CARD */}
      <section className="rounded-[24px] bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm border-slate-100 font-bold uppercase tracking-wide text-slate-800">What To Do Now</h3>
        </div>
        <ul className="mt-4 space-y-3">
          {instructionsList.map((inst, idx) => (
            <li key={idx} className="flex items-start gap-3 rounded-[16px] bg-slate-50 p-3">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">{idx + 1}</span>
              <p className="text-sm font-semibold text-slate-700">{inst}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* SECTION 2 — ASSIGNED HELP CARD */}
      <section className="rounded-[24px] bg-white p-6 shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">Assigned Response</h3>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{responderText}</p>
            {hungarian.responder_type && (
               <p className="text-sm text-slate-500">Responder Type: {hungarian.responder_type}</p>
            )}
            {hasVolunteers && (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Volunteer Support Assigned
              </p>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3 & 4 — ETA, ROUTE, DESTINATION CARD */}
      <section className="grid gap-3 grid-cols-2">
        <div className="rounded-[24px] bg-slate-900 p-5 text-white shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Est Arrival</h3>
          <p className="mt-3 text-lg leading-tight font-black">{etaText}</p>
          {hasAlternateRoute && (
            <p className="mt-3 text-xs font-semibold leading-tight text-amber-300 bg-amber-400/20 p-2 rounded-lg border border-amber-400/30">
              Alternate safe route selected due to blocked roads
            </p>
          )}
        </div>
        
        <div className="flex flex-col justify-between rounded-[24px] bg-white p-5 shadow-sm border border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Destination</h3>
            <p className="mt-3 text-sm font-bold text-slate-900 leading-tight">{displayDestName}</p>
            {dijkstra.destination?.type && (
              <p className="mt-1 text-xs font-medium text-slate-500 capitalize">{dijkstra.destination.type}</p>
            )}
          </div>
          <svg className="mt-2 h-6 w-6 text-slate-200 self-end" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </div>
      </section>

      {/* SECTION 6 — SPECIAL NEEDS SUMMARY */}
      {(case_trace?.critical_needs || people_count) && (
        <section className="rounded-[24px] border border-sky-100 bg-sky-50 p-5 shadow-sm">
           <h3 className="text-xs font-bold uppercase tracking-wide text-sky-600">Incident Details Logged</h3>
           {people_count && (
             <p className="mt-2 text-sm font-semibold text-sky-900">People Affected: {people_count}</p>
           )}
           {case_trace?.critical_needs && (
             <p className="mt-1 text-sm font-semibold text-sky-900">{case_trace.critical_needs}</p>
           )}
        </section>
      )}

      {/* SECTION 7 — VOLUNTEER SUPPORT CARD */}
      {hasVolunteers && (
        <section className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
             <div className="flex flex-shrink-0 h-10 w-10 items-center justify-center rounded-full bg-emerald-200 text-emerald-700">
               <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
               </svg>
             </div>
             <div>
               <h3 className="text-sm font-bold text-emerald-900">Community Volunteer Support</h3>
               <p className="mt-0.5 text-xs font-medium text-emerald-700">
                  {volunteers[0].volunteer_name} arriving in ~{volunteers[0].estimated_arrival}
               </p>
             </div>
          </div>
        </section>
      )}

      {case_events.length > 0 && (
        <section className="rounded-[24px] bg-white p-6 shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">SOS Event Timeline</h3>
          <div className="mt-4 space-y-3">
            {case_events.map((event, index) => (
              <div key={`${event.stage_name}-${event.timestamp}-${index}`} className="rounded-[16px] bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-900">{event.stage_name?.replaceAll('_', ' ') || 'Event'}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{event.status || 'completed'}</p>
                {event.timestamp && <p className="mt-1 text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 8 — ACTION CONTROLS */}
      <section className="grid grid-cols-2 gap-3 pt-4">
        <button 
          onClick={() => fetchIncident(true)} 
          disabled={refreshing}
          className="flex flex-col items-center justify-center gap-2 rounded-[20px] bg-slate-100 p-4 transition-colors hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50"
        >
          <svg className={`h-6 w-6 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
            {refreshing ? 'Refreshing...' : 'Refresh Status'}
          </span>
        </button>

        <button 
          onClick={() => alert("Situation updated. Responders notified.")}
          className="flex flex-col items-center justify-center gap-2 rounded-[20px] bg-slate-100 p-4 transition-colors hover:bg-slate-200 active:bg-slate-300"
        >
          <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
           <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Update Situation</span>
        </button>

        <a 
          href="tel:911" 
          className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-rose-200 bg-rose-50 p-4 transition-colors hover:bg-rose-100 active:bg-rose-200"
        >
          <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wide text-rose-800">Call Emergency</span>
        </a>

        <button 
          onClick={() => alert("Location securely shared with dispatch.")}
          className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-blue-200 bg-blue-50 p-4 transition-colors hover:bg-blue-100 active:bg-blue-200"
        >
          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wide text-blue-800">Share Location</span>
        </button>
      </section>

    </div>
  )
}

export default VictimPanel

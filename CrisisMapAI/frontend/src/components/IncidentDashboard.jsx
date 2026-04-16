import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { getIncidentDetails, getVictimIncidents, SOCKET_BASE_URL } from '../api/client'
import LiveMap from './LiveMap'
import RouteVisualization from './RouteVisualization'
import DecisionTrace from './DecisionTrace'
import ETATimeline from './ETATimeline'
import FailureSimulation from './FailureSimulation'

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'map',      label: 'Live Map',  icon: '🗺️' },
  { id: 'routes',   label: 'Routes',    icon: '🔀' },
  { id: 'trace',    label: 'AI Trace',  icon: '🧠' },
  { id: 'timeline', label: 'Timeline',  icon: '⏱️' },
  { id: 'simulate', label: 'Simulate',  icon: '⚡' },
]

const IncidentDashboard = () => {
  const { sosId } = useParams()
  const [searchParams] = useSearchParams()
  const victimId = searchParams.get('victimId')
  const [incident, setIncident] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchIncident = async () => {
    try {
      const data = await getIncidentDetails(sosId)
      setIncident(data)
    } catch {
      if (victimId) {
        try {
          const incidents = await getVictimIncidents(victimId)
          const match = incidents.find(inc => inc.sos_id === sosId || inc.id === sosId)
          setIncident(match || incidents[0] || null)
        } catch { /* noop */ }
      }
    } finally {
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
          const id = payload.incident_id || payload.data?.sos_id
          if (id === sosId) fetchIncident()
        }
      } catch { /* noop */ }
    }
    return () => socket.close()
  }, [sosId])

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="font-semibold text-slate-500">Loading incident dashboard...</p>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">Incident not found</h2>
        <p className="mt-2 text-slate-600">Could not load data for SOS #{sosId}</p>
        <Link to="/workspace" className="mt-4 button-primary">Back to Workspace</Link>
      </div>
    )
  }

  const ar = incident.algorithm_results || {}
  const caseEvents = incident.case_events || []
  const dijkstra = ar.dijkstra || {}
  const hungarian = ar.hungarian_assignment || {}
  const status = incident.status || 'received'

  const score = incident.priority_score || ar.priority_queue?.score || 0
  let priorityLabel = 'Low'
  let priorityColor = 'bg-emerald-500'
  if (score < 1) { priorityLabel = 'Critical'; priorityColor = 'bg-rose-500' }
  else if (score < 2) { priorityLabel = 'High'; priorityColor = 'bg-orange-500' }
  else if (score < 3) { priorityLabel = 'Medium'; priorityColor = 'bg-amber-500' }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/workspace" className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-bold text-slate-700">SOS #{(sosId || '').slice(0, 8)}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${priorityColor}`}>{priorityLabel}</span>
        </div>
        <button onClick={fetchIncident} className="button-soft text-xs py-2 px-3">
          <svg className="h-4 w-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-[20px] bg-white border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Status</p>
          <p className="mt-1 text-lg font-black text-slate-900 capitalize">{status.replace(/_/g, ' ')}</p>
        </div>
        <div className="rounded-[20px] bg-white border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">ETA</p>
          <p className="mt-1 text-lg font-black text-slate-900">{incident.eta || dijkstra.eta || '--'}</p>
        </div>
        <div className="rounded-[20px] bg-white border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Responder</p>
          <p className="mt-1 text-sm font-bold text-slate-900 truncate">{incident.responder || hungarian.responder_name || 'Pending'}</p>
        </div>
        <div className="rounded-[20px] bg-white border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Severity</p>
          <p className="mt-1 text-lg font-black text-slate-900 capitalize">{ar.bayesian_severity?.inferred_severity || incident.severity || '--'}</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white bg-white/85 p-1.5 shadow-sm backdrop-blur">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <LiveMap incident={incident} algorithmResults={ar} showRoutes showBackups={false} />
              <ETATimeline incident={incident} algorithmResults={ar} caseEvents={caseEvents} />
            </div>
            <DecisionTrace algorithmResults={ar} caseEvents={caseEvents} />
          </div>
        )}

        {activeTab === 'map' && (
          <LiveMap incident={incident} algorithmResults={ar} showRoutes showBackups />
        )}

        {activeTab === 'routes' && (
          <RouteVisualization incident={incident} algorithmResults={ar} />
        )}

        {activeTab === 'trace' && (
          <DecisionTrace algorithmResults={ar} caseEvents={caseEvents} />
        )}

        {activeTab === 'timeline' && (
          <ETATimeline incident={incident} algorithmResults={ar} caseEvents={caseEvents} />
        )}

        {activeTab === 'simulate' && (
          <FailureSimulation
            sosId={sosId}
            incident={incident}
            algorithmResults={ar}
            onRerunComplete={(data) => {
              if (data.new_algorithm_results) {
                setIncident(prev => ({
                  ...prev,
                  algorithm_results: {
                    ...prev.algorithm_results,
                    ...data.new_algorithm_results,
                  },
                }))
              }
            }}
          />
        )}
      </div>
    </div>
  )
}

export default IncidentDashboard

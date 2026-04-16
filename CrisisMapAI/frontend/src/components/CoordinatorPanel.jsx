import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
  getDashboardData,
  getIncidentDetails,
  getIncidents,
  normalizeIncident,
  SOCKET_BASE_URL,
} from '../api/client'
import { Link } from 'react-router-dom'
import DecisionTracePanel from './DecisionTracePanel'
import OperationsMap from './OperationsMap'
import RouteVisualizationPanel from './RouteVisualizationPanel'
import SimulationControlPanel from './SimulationControlPanel'
import StatusTimeline from './StatusTimeline'
import { deriveDecisionTrace, deriveRouteVariants, getDestinationPoint } from '../utils/incidentVisuals'

const severityClassName = (severity) => {
  const s = String(severity).toLowerCase()
  if (s.includes('critical')) return 'bg-rose-100 text-rose-800 border-rose-200'
  if (s.includes('high')) return 'bg-orange-100 text-orange-800 border-orange-200'
  if (s.includes('medium')) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-emerald-100 text-emerald-800 border-emerald-200'
}

const CoordinatorPanel = () => {
  const session = useMemo(() => {
    try {
      return JSON.parse(window.localStorage.getItem('crisismap_session') || 'null')
    } catch {
      return null
    }
  }, [])
  const organizationId = session?.role === 'organization' ? session.subject_id : null
  const [dashboardData, setDashboardData] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [loading, setLoading] = useState(true)
  const [simulation, setSimulation] = useState(null)
  const [auditTrail, setAuditTrail] = useState([])
  const [replayActive, setReplayActive] = useState(false)
  const [replayIndex, setReplayIndex] = useState(0)
  const selectedIncidentRef = useRef(null)

  useEffect(() => {
    selectedIncidentRef.current = selectedIncident
  }, [selectedIncident])

  const loadIncidentDetail = async (incidentLike) => {
    if (!incidentLike) return null
    try {
      return await getIncidentDetails(incidentLike.sos_id || incidentLike.id)
    } catch (error) {
      console.error('Failed to load incident detail:', error)
      return incidentLike
    }
  }

  useEffect(() => {
    const loadScopedData = async () => {
      const [dashboard, incidentsData] = await Promise.all([
        getDashboardData(organizationId),
        getIncidents(organizationId),
      ])
      setDashboardData(dashboard)
      setIncidents(incidentsData)
      setSelectedIncident(await loadIncidentDetail(incidentsData[0] || null))
    }

    const fetchData = async () => {
      try {
        await loadScopedData()
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    const wsUrl = SOCKET_BASE_URL.replace(/^http/, 'ws') + '/ws'
    const socket = new WebSocket(wsUrl)

    socket.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data)
        setAuditTrail((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            label: payload.type === 'dashboard_update' ? 'Dashboard metrics refreshed' : payload.type === 'incident_update' ? 'Incident state changed' : 'Live operational event',
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 12))
        if (payload.type === 'dashboard_update') {
          if (organizationId) {
            await loadScopedData()
          } else {
            setDashboardData(payload.data)
          }
        } else if (payload.type === 'incident_update') {
          const normalized = normalizeIncident(payload.data)
          if (organizationId) {
            await loadScopedData()
          } else {
            setIncidents((prev) => {
              const next = [...prev.filter((incident) => incident.id !== normalized.id), normalized]
              return next.sort((a, b) => (a.priority_score || 0) < (b.priority_score || 0) ? 1 : -1)
            })
            const current = selectedIncidentRef.current
            if ((current?.id && normalized.id === current.id) || (current?.sos_id && normalized.sos_id === current.sos_id)) {
              setSelectedIncident(await loadIncidentDetail(normalized))
            }
          }
        }
      } catch (error) {
        console.error('WebSocket processing error:', error)
      }
    }

    return () => socket.close()
  }, [organizationId])

  const activeIncidents = useMemo(
    () => incidents.filter((incident) => incident.status !== 'resolved'),
    [incidents]
  )

  const routeVariants = deriveRouteVariants(selectedIncident || {}, simulation)
  const liveRoute = routeVariants.find((route) => route.isActive)
  const destinationPoint = getDestinationPoint(selectedIncident || {}, liveRoute)
  const replaySteps = deriveDecisionTrace(selectedIncident || {}, simulation)

  useEffect(() => {
    setReplayIndex(0)
    setReplayActive(false)
  }, [selectedIncident?.id, simulation?.type])

  useEffect(() => {
    if (!replayActive || replaySteps.length === 0) return undefined
    const timer = window.setInterval(() => {
      setReplayIndex((current) => {
        if (current >= replaySteps.length - 1) {
          setReplayActive(false)
          return current
        }
        return current + 1
      })
    }, 1200)
    return () => window.clearInterval(timer)
  }, [replayActive, replaySteps.length])

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <p className="font-semibold text-slate-500">Initializing live command center...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[26px] bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Live Incidents</p>
          <p className="mt-2 text-3xl font-black">{dashboardData?.activeIncidents || activeIncidents.length}</p>
          <p className="mt-2 text-xs text-slate-400">Cases still being triaged, routed, or resolved</p>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Priority Queue</p>
          <p className="mt-2 text-3xl font-black text-rose-600">{activeIncidents.filter((incident) => (incident.priority_score || 0) < 1).length}</p>
          <p className="mt-2 text-xs text-slate-500">Critical incidents demanding immediate dispatch</p>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Responder Readiness</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{dashboardData?.availableResponders || 0}</p>
          <p className="mt-2 text-xs text-slate-500">Units currently available for assignment</p>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Destination Load</p>
          <div className="mt-2 flex gap-3 text-xl font-black">
            <span className="text-sky-700">{dashboardData?.hospitalCapacity || 0}% Hosp</span>
            <span className="text-violet-700">{dashboardData?.shelterOccupancy || 0}% Shltr</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Capacity pressure visible before failure mode triggers</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 px-2 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Priority Queue</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Active incidents</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {activeIncidents.length} live
              </div>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {activeIncidents.map((incident, index) => {
                const isSelected = selectedIncident?.id === incident.id
                const displaySeverity = incident.algorithm_results?.bayesian_severity?.inferred_severity || incident.severity
                return (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={async () => {
                      setSimulation(null)
                      setSelectedIncident(await loadIncidentDetail(incident))
                    }}
                    className={`w-full rounded-[22px] border p-4 text-left transition ${
                      isSelected ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Q#{index + 1} • {incident.zone || 'Unmapped zone'}</p>
                        <p className="mt-2 text-base font-black capitalize text-slate-950">{incident.disaster_type || 'Emergency'}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${severityClassName(displaySeverity)}`}>
                        {displaySeverity || 'medium'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500">Assigned: {incident.responder || 'Pending'}</span>
                      <span className="text-slate-400 uppercase">{incident.status || 'received'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <SimulationControlPanel
            simulation={simulation}
            onActivate={setSimulation}
            onReset={() => setSimulation(null)}
          />
        </aside>

        <div className="space-y-6">
          {selectedIncident ? (
            <>
              <section className="rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,#0f172a_0%,#111827_35%,#0f766e_100%)] p-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300">Operational Intelligence Panel</p>
                    <h1 className="mt-2 text-4xl font-black tracking-tight capitalize">{selectedIncident.disaster_type || 'Emergency'} incident</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
                      Live routing, assignment, ETA, and destination decisions pulled from the SOS replay pipeline and refreshed over WebSockets.
                    </p>
                  </div>
                  <div className="grid gap-3 text-sm font-semibold sm:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-white/10 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Selected responder</p>
                      <p className="mt-2 text-lg font-black text-white">{selectedIncident.responder || selectedIncident.assignment?.responder_name || 'Pending'}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/10 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Destination</p>
                      <p className="mt-2 text-lg font-black text-white">{destinationPoint.name}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReplayIndex(0)
                      setReplayActive((current) => !current)
                    }}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white/20"
                  >
                    {replayActive ? 'Pause replay' : 'Replay decision timeline'}
                  </button>
                  {replaySteps[replayIndex] && (
                    <div className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">
                      Step {replayIndex + 1}: {replaySteps[replayIndex].title}
                    </div>
                  )}
                </div>
              </section>

              <OperationsMap incident={selectedIncident} incidents={activeIncidents} simulation={simulation} />

              <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <RouteVisualizationPanel incident={selectedIncident} simulation={simulation} />
                <StatusTimeline incident={selectedIncident} simulation={simulation} />
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <DecisionTracePanel incident={selectedIncident} simulation={simulation} activeStepIndex={replayActive ? replayIndex : null} />
                <div className="space-y-6">
                <div className="rounded-[28px] border border-white/90 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Operational Snapshot</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Backend outputs at a glance</h3>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Priority + severity</p>
                      <p className="mt-3 text-lg font-black text-slate-950">Score {selectedIncident.priority_score ?? 'N/A'}</p>
                      <p className="mt-1 text-sm text-slate-600 capitalize">{selectedIncident.inferred_severity || selectedIncident.severity || 'medium'}</p>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Dispatch mode</p>
                      <p className="mt-3 text-lg font-black text-slate-950 capitalize">{selectedIncident.algorithm_results?.dispatch_mode?.responder_type || 'Standard responder'}</p>
                      <p className="mt-1 text-sm text-slate-600">{selectedIncident.algorithm_results?.dispatch_mode?.destination || 'Destination pending'}</p>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Why this assignment?</p>
                      <div className="mt-3 grid gap-2">
                        {[
                          selectedIncident.algorithm_results?.hungarian_assignment?.rationale || selectedIncident.algorithm_results?.hungarian_assignment?.explanation,
                          selectedIncident.algorithm_results?.hungarian_assignment?.responder_type ? `${selectedIncident.algorithm_results.hungarian_assignment.responder_type} capability selected.` : null,
                          selectedIncident.algorithm_results?.dijkstra?.destination?.reason || null,
                        ].filter(Boolean).map((reason) => (
                          <p key={reason} className="text-sm font-semibold text-slate-700">{reason}</p>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Volunteer support</p>
                      <p className="mt-3 text-lg font-black text-slate-950">{selectedIncident.algorithm_results?.gale_shapley?.length || 0} matched</p>
                      <p className="mt-1 text-sm text-slate-600">Community augmentation for overflow and access support</p>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Simulation status</p>
                      <p className="mt-3 text-lg font-black text-slate-950">{simulation?.title || 'Live mode only'}</p>
                      <p className="mt-1 text-sm text-slate-600">{simulation?.impact || 'No disruption is overriding the live backend result.'}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[28px] border border-white/90 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Recent changes audit</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Live operational feed</h3>
                  <div className="mt-5 space-y-3">
                    {auditTrail.length > 0 ? auditTrail.map((entry) => (
                      <div key={entry.id} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-bold text-slate-950">{entry.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
                      </div>
                    )) : (
                      <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        Waiting for incoming websocket events.
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/85 p-10 text-center text-slate-500">
              Select an incident from the queue to open the live operations surface.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default CoordinatorPanel

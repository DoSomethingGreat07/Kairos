import React, { useEffect, useMemo, useState } from 'react'

import { getDashboardData, getIncidents, SOCKET_BASE_URL, normalizeIncident } from '../api/client'
import IncidentMap from './IncidentMap'

const severityClassName = (severity) => {
  const s = String(severity).toLowerCase()
  if (s.includes('critical')) return 'bg-rose-100 text-rose-800 border-rose-200'
  if (s.includes('high')) return 'bg-orange-100 text-orange-800 border-orange-200'
  if (s.includes('medium')) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-emerald-100 text-emerald-800 border-emerald-200'
}

const CoordinatorPanel = () => {
  const [dashboardData, setDashboardData] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [activeTab, setActiveTab] = useState('audit') // 'audit', 'route', 'logistics', 'volunteers'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboard, incidentsData] = await Promise.all([
          getDashboardData(),
          getIncidents(),
        ])
        setDashboardData(dashboard)
        setIncidents(incidentsData)
        setSelectedIncident(incidentsData[0] || null)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    const wsUrl = SOCKET_BASE_URL.replace(/^http/, 'ws') + '/ws'
    const socket = new WebSocket(wsUrl)
    
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'dashboard_update') {
          setDashboardData(payload.data)
        } else if (payload.type === 'incident_update') {
          setIncidents((prev) => {
            const normalized = normalizeIncident(payload.data)
            const next = [...prev.filter((incident) => incident.id !== payload.data.id), normalized]
            return next.sort((a, b) => (a.priority_score || 0) < (b.priority_score || 0) ? 1 : -1)
          })
          setSelectedIncident((current) => (current?.id === payload.data.id ? normalizeIncident(payload.data) : current))
        }
      } catch (err) {}
    }

    return () => socket.close()
  }, [])

  const activeIncidents = useMemo(
    () => incidents.filter((incident) => incident.status !== 'resolved'),
    [incidents]
  )

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="font-semibold text-slate-500">Initializing Command Center...</p>
      </div>
    )
  }

  const renderSelectedIncidentContext = () => {
    if (!selectedIncident) return <div className="text-slate-500 text-center py-10">Select an incident to view intelligence payload.</div>

    const {
      algorithm_results = {},
      messages = {},
      case_trace = {},
      status, eta, priority_score
    } = selectedIncident

    const bayesian = algorithm_results.bayesian_severity || {}
    const dijkstra = algorithm_results.dijkstra || {}
    const yenRoutes = algorithm_results.yen_routes || []
    const hungarian = algorithm_results.hungarian_assignment || {}
    const volMatch = algorithm_results.gale_shapley || []
    const minCostFlow = algorithm_results.min_cost_flow || {}

    return (
      <div className="space-y-4">
        {/* HEADER */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl font-black capitalize text-slate-900">{selectedIncident.disaster_type} Incident <span className="text-slate-400">#{selectedIncident.sos_id || selectedIncident.id}</span></h2>
            <p className="text-sm text-slate-600 mt-1 capitalize">{case_trace.critical_needs || 'No critical flags logged manually.'}</p>
          </div>
          <div className="text-right">
             <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${severityClassName(bayesian.inferred_severity || selectedIncident.severity)}`}>
                Score: {priority_score || 'N/A'} — {bayesian.inferred_severity || selectedIncident.severity || 'Normal'}
             </span>
             <p className="text-xs text-slate-500 mt-2 font-semibold">STATUS: <span className="text-slate-800 uppercase">{status}</span></p>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['audit', 'route', 'logistics', 'volunteers'].map((tab) => (
             <button 
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
             >
               {tab.replace('_', ' ')}
             </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div className="pt-2">
          
          {/* TAB: AUDIT TRAIL / EXPLAINABILITY */}
          {activeTab === 'audit' && (
            <div className="grid gap-4 md:grid-cols-2">
               <div className="p-4 rounded-[20px] bg-indigo-50 border border-indigo-100">
                  <h3 className="text-xs font-bold uppercase text-indigo-800 mb-2">Algorithm Audit: Severity Inference</h3>
                  <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                    {messages.coordinator_summary || 'Bayesian layers interpreted standard signals mapped with default priority thresholding.'}
                  </p>
               </div>
               
               <div className="p-4 rounded-[20px] bg-slate-50 border border-slate-200">
                  <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Algorithm Audit: Responder Allocation</h3>
                  <p className="text-sm text-slate-800 font-medium">Selected Unit: <span className="font-bold">{selectedIncident.responder || 'Unassigned'}</span></p>
                  <p className="text-xs text-slate-600 mt-1">Hungarian matching utilized <span className="font-semibold text-slate-800">{hungarian.responder_type || 'default'}</span> constraints to minimize global cost.</p>
               </div>

               <div className="md:col-span-2 p-4 rounded-[20px] bg-slate-50 border border-slate-200">
                  <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Case Timeline Overview</h3>
                  <div className="flex items-center gap-4 overflow-x-auto pb-2 text-xs font-semibold text-slate-500">
                     <span className="shrink-0 text-indigo-600 bg-indigo-100 px-2 py-1 rounded">SOS Created</span> →
                     <span className="shrink-0 text-indigo-600 bg-indigo-100 px-2 py-1 rounded">Prioritized</span> →
                     <span className="shrink-0 text-indigo-600 bg-indigo-100 px-2 py-1 rounded">Inferred ({bayesian.inferred_severity || 'processed'})</span> →
                     <span className={`shrink-0 px-2 py-1 rounded ${status !== 'received' ? 'text-indigo-600 bg-indigo-100' : 'text-slate-400 bg-slate-100'}`}>Assigned</span> →
                     <span className={`shrink-0 px-2 py-1 rounded ${status === 'processed' || status === 'resolved' ? 'text-indigo-600 bg-indigo-100' : 'text-slate-400 bg-slate-100'}`}>Routed/Completed</span>
                  </div>
               </div>
            </div>
          )}

          {/* TAB: ROUTE INTELLIGENCE */}
          {activeTab === 'route' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-5 rounded-[20px] bg-slate-900 text-white shadow-xl">
                    <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Target Destination</h3>
                    <p className="text-xl font-black">{dijkstra.destination?.name || selectedIncident.destination || 'Unassigned'}</p>
                    <p className="text-sm text-slate-400 mt-1 capitalize">{dijkstra.destination?.type || 'General Location'}</p>
                    <p className="text-xs mt-3 bg-white/10 px-2 py-1 rounded inline-block">ETA: {eta || 'TBD'}</p>
                </div>
                <div className="p-4 rounded-[20px] bg-rose-50 border border-rose-100 text-rose-900">
                    <h3 className="text-xs font-bold uppercase mb-2">Route Hazards / Blockages</h3>
                    {dijkstra.excluded_edges?.length > 0 ? (
                      <p className="text-sm font-semibold">Algorithm bypassed blocked edges safely navigating dynamic hazards.</p>
                    ) : (
                      <p className="text-sm">No active road hazards triggered replanning.</p>
                    )}
                    <h3 className="text-xs font-bold uppercase mt-4 mb-1">Yen's Backup Routes</h3>
                    <p className="text-xs font-semibold">{yenRoutes.length} mathematically viable backup trajectories stored.</p>
                </div>
              </div>
              <div className="rounded-[20px] overflow-hidden border border-slate-200">
                 <IncidentMap incidents={[selectedIncident]} />
              </div>
            </div>
          )}

          {/* TAB: LOGISTICS & HOSPITAL LOADS */}
          {activeTab === 'logistics' && (
            <div className="grid md:grid-cols-2 gap-4">
               <div className="p-4 rounded-[20px] bg-sky-50 border border-sky-100 text-sky-900">
                  <h3 className="text-xs font-bold uppercase mb-2">Hospital / Shelter Intake Load</h3>
                  <p className="text-sm font-medium mb-1">Dispatch Mode: <span className="font-bold capitalize">{algorithm_results.dispatch_mode || 'Standard'}</span></p>
                  <p className="text-xs text-sky-700 bg-sky-100/50 p-2 rounded-lg mt-2">Destination reason: {dijkstra.destination?.reason || 'Calculated as lowest-cost reachable node considering capacity constraints.'}</p>
               </div>
               
               <div className="p-4 rounded-[20px] bg-indigo-50 border border-indigo-100 text-indigo-900">
                  <h3 className="text-xs font-bold uppercase mb-2">Supply Logistics (Min-Cost Flow)</h3>
                  {minCostFlow.flow_cost ? (
                    <>
                      <p className="text-sm font-bold mb-1">Calculated Flow Cost: {minCostFlow.flow_cost}</p>
                      <p className="text-xs text-indigo-700 mt-2">Optimal supply depot shipments validated against shelter demands for expected influx.</p>
                    </>
                  ) : (
                    <p className="text-sm text-indigo-600">No active supply constraints mapped exclusively to this incident yet.</p>
                  )}
               </div>
            </div>
          )}

          {/* TAB: VOLUNTEERS */}
          {activeTab === 'volunteers' && (
            <div className="space-y-4">
              {volMatch.length > 0 ? volMatch.map((v, i) => (
                <div key={i} className="flex flex-wrap gap-4 items-center justify-between p-4 rounded-[20px] bg-emerald-50 border border-emerald-100">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900">{v.volunteer_name}</h3>
                    <p className="text-xs font-medium text-emerald-700">Matched to support role</p>
                  </div>
                  <div className="bg-white px-3 py-1 rounded-lg border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-800 uppercase">ETA {v.estimated_arrival}</p>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center rounded-[20px] bg-slate-50 border border-dashed border-slate-300 text-slate-500">
                  <p className="text-sm font-medium">No community volunteers assigned to this active event.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* 1. TOP METRICS / OVERVIEW */}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] bg-slate-900 p-5 text-white shadow">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total Live Incidents</p>
          <p className="mt-2 text-3xl font-black">{dashboardData?.activeIncidents || activeIncidents.length}</p>
        </div>
        <div className="rounded-[24px] bg-white border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Global Priority Queue</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{activeIncidents.filter(i => (i.priority_score || 0) < 1).length} Critical</p>
        </div>
        <div className="rounded-[24px] bg-white border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Responders Ready</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{dashboardData?.availableResponders || 0} Units</p>
        </div>
        <div className="rounded-[24px] bg-white border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">System Load</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-sky-700">{dashboardData?.hospitalCapacity || 0}% Hosp</span>
            <span className="text-sm font-semibold text-slate-400">/</span>
            <span className="text-lg font-bold text-violet-700">{dashboardData?.shelterOccupancy || 0}% Shl</span>
          </div>
        </div>
      </section>

      {/* 2. MAIN SPLIT VIEW */}
      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr] items-start">
        
        {/* LEFT COMPONENT: INCIDENTS TABLE / PRIORITY QUEUE VIEW */}
        <div className="rounded-[28px] bg-white p-2 shadow-sm border border-slate-200">
           <div className="p-4">
             <h2 className="text-lg font-black text-slate-900">Active Priority Queue</h2>
             <p className="text-xs text-slate-500">Algorithmic ingestion ranking active operations.</p>
           </div>
           <div className="flex flex-col gap-1 px-2 pb-2 h-[600px] overflow-y-auto custom-scrollbar">
             {activeIncidents.map((incident, idx) => {
               const isSelected = selectedIncident?.id === incident.id
               const bayesian = incident.algorithm_results?.bayesian_severity || {}
               const pScore = incident.priority_score || 'N/A'
               return (
                 <button
                   key={incident.id}
                   onClick={() => setSelectedIncident(incident)}
                   className={`text-left w-full rounded-[20px] p-4 transition-all border ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-transparent hover:bg-slate-50'}`}
                 >
                   <div className="flex justify-between items-start">
                     <div>
                       <p className="text-xs mb-1 font-bold opacity-60">Q#{idx+1} — {incident.zone}</p>
                       <p className="text-sm font-black capitalize leading-tight">{incident.disaster_type}</p>
                     </div>
                     <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${isSelected ? 'bg-white/20 text-white' : severityClassName(bayesian.inferred_severity || incident.severity)}`}>
                       {pScore}
                     </span>
                   </div>
                   <div className="mt-3 flex items-center justify-between">
                     <p className={`text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'} font-medium`}>Assigned: {incident.responder || 'Pending'}</p>
                     <p className={`text-xs ${isSelected ? 'text-indigo-300 font-bold' : 'text-slate-400'}`}>{incident.status}</p>
                   </div>
                 </button>
               )
             })}
           </div>
        </div>

        {/* RIGHT COMPONENT: DEEP INTELLIGENCE */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm border border-slate-200 sticky top-6">
           <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Operational Intelligence Panel</h2>
           {renderSelectedIncidentContext()}
        </div>

      </section>
    </div>
  )
}

export default CoordinatorPanel

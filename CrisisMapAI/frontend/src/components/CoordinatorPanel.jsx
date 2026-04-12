import React, { useEffect, useMemo, useState } from 'react'
import io from 'socket.io-client'
import { getDashboardData, getIncidents, SOCKET_BASE_URL } from '../api/client'
import IncidentMap from './IncidentMap'

const severityClassName = (severity) => {
  if (severity === 'critical') return 'badge badge-critical'
  if (severity === 'high') return 'badge badge-high'
  if (severity === 'medium') return 'badge badge-medium'
  return 'badge badge-low'
}

const CoordinatorPanel = () => {
  const [dashboardData, setDashboardData] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [selectedIncident, setSelectedIncident] = useState(null)
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

    const socket = io(SOCKET_BASE_URL)
    socket.on('dashboard_update', (data) => setDashboardData(data))
    socket.on('incident_update', (data) => {
      setIncidents((prev) => {
        const next = [...prev.filter((incident) => incident.id !== data.id), data]
        return next.sort((a, b) => (a.priority_score || 0) < (b.priority_score || 0) ? 1 : -1)
      })
      setSelectedIncident((current) => (current?.id === data.id ? data : current))
    })

    return () => socket.disconnect()
  }, [])

  const activeIncidents = useMemo(
    () => incidents.filter((incident) => incident.status !== 'resolved'),
    [incidents]
  )

  if (loading) {
    return <div className="panel text-center py-16 text-slate-500">Loading coordinator console...</div>
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="metric-card">
          <p className="metric-label">Active incidents</p>
          <p className="metric-value text-rose-600">{dashboardData?.activeIncidents || activeIncidents.length}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Responders ready</p>
          <p className="metric-value text-emerald-600">{dashboardData?.availableResponders || 0}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Hospital capacity</p>
          <p className="metric-value text-sky-600">{dashboardData?.hospitalCapacity || 0}%</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Shelter occupancy</p>
          <p className="metric-value text-violet-600">{dashboardData?.shelterOccupancy || 0}%</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="panel">
          <p className="section-kicker">Operations Queue</p>
          <h2 className="panel-title mt-2">Live incident board</h2>
          <div className="mt-5 space-y-3">
            {activeIncidents.map((incident) => (
              <button
                key={incident.id}
                type="button"
                className={`w-full rounded-[22px] border p-4 text-left transition ${
                  selectedIncident?.id === incident.id
                    ? 'border-slate-900 bg-slate-950 text-white'
                    : 'border-slate-100 bg-slate-50/80 hover:border-slate-200 hover:bg-white'
                }`}
                onClick={() => setSelectedIncident(incident)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-bold capitalize">{incident.disaster_type} in {incident.zone}</p>
                    <p className={`mt-1 text-sm ${selectedIncident?.id === incident.id ? 'text-slate-300' : 'text-slate-500'}`}>
                      {incident.people_count} people • {incident.status.replace('_', ' ')} • ETA {incident.eta || 'TBD'}
                    </p>
                  </div>
                  <span className={severityClassName(incident.severity)}>
                    {incident.severity}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel">
            <p className="section-kicker">Incident Focus</p>
            <h2 className="panel-title mt-2">Selected incident details</h2>
            {selectedIncident ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Incident</p>
                  <p className="mt-2 text-xl font-bold capitalize text-slate-950">{selectedIncident.disaster_type}</p>
                  <p className="mt-1 text-sm text-slate-500">{selectedIncident.zone}</p>
                </div>
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Responder</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">{selectedIncident.responder?.name || 'Unassigned'}</p>
                  <p className="mt-1 text-sm text-slate-500">{selectedIncident.eta || 'ETA pending'}</p>
                </div>
                <div className="rounded-[22px] bg-slate-50 p-4 md:col-span-2">
                  <p className="text-sm text-slate-500">Operational signals</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={severityClassName(selectedIncident.severity)}>{selectedIncident.severity}</span>
                    <span className="badge badge-medium">{selectedIncident.people_count} people</span>
                    {selectedIncident.oxygen_required && <span className="badge badge-high">oxygen required</span>}
                    {selectedIncident.injury && <span className="badge badge-high">injuries present</span>}
                    {selectedIncident.elderly && <span className="badge badge-medium">elderly involved</span>}
                  </div>
                  <p className="mt-4 text-sm text-slate-600">{selectedIncident.note || 'No additional field notes provided.'}</p>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">Select an incident to inspect responder fit and urgency.</p>
            )}
          </div>

          <div className="panel">
            <p className="section-kicker">Map</p>
            <h3 className="panel-title mt-2">Geographic context</h3>
            <div className="mt-5">
              <IncidentMap incidents={activeIncidents} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default CoordinatorPanel

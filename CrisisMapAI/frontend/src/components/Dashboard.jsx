import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardData } from '../api/client'

const statusTone = {
  assigned: 'badge badge-medium',
  en_route: 'badge badge-high',
  received: 'badge badge-critical',
  resolved: 'badge badge-low',
}

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getDashboardData()
        setDashboardData(data)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const utilization = useMemo(() => {
    if (!dashboardData) return 0
    const used = Math.max(0, dashboardData.activeIncidents || 0)
    const available = Math.max(1, dashboardData.availableResponders || 1)
    return Math.min(100, Math.round((used / available) * 100))
  }, [dashboardData])

  if (loading) {
    return <div className="panel text-center py-16 text-slate-500">Loading command overview...</div>
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="panel overflow-hidden">
          <p className="section-kicker">Mission Overview</p>
          <h2 className="panel-title mt-2 text-3xl">Emergency operations at a glance</h2>
          <p className="panel-subtitle max-w-2xl">
            Monitor intake pressure, responder readiness, and shelter or hospital strain from a single command view.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <p className="metric-label">Active Incidents</p>
              <p className="metric-value text-rose-600">{dashboardData?.activeIncidents || 0}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Available Responders</p>
              <p className="metric-value text-emerald-600">{dashboardData?.availableResponders || 0}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Hospital Beds</p>
              <p className="metric-value text-sky-600">{dashboardData?.availableBeds || 0}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Shelter Capacity</p>
              <p className="metric-value text-violet-600">{dashboardData?.availableShelterCapacity || 0}</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <p className="section-kicker">Quick Actions</p>
          <h3 className="panel-title mt-2">Move fast</h3>
          <div className="mt-5 grid gap-3">
            <Link to="/sos" className="button-danger w-full">Open Emergency SOS Intake</Link>
            <Link to="/coordinator" className="button-primary w-full">Open Coordinator Console</Link>
            <Link to="/map" className="button-soft w-full">View Incident Map</Link>
          </div>
          <div className="mt-6 rounded-[22px] bg-slate-950 p-5 text-white">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-300">Responder Utilization</p>
            <p className="mt-3 text-4xl font-black">{utilization}%</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${utilization}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel">
          <p className="section-kicker">Recent Incidents</p>
          <h3 className="panel-title mt-2">Active pressure on the system</h3>
          <div className="mt-5 space-y-3">
            {(dashboardData?.recentIncidents || []).map((incident) => (
              <div key={incident.id} className="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-bold capitalize text-slate-950">
                      {incident.disaster_type} in {incident.zone}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {incident.people_count} people affected • {incident.severity} severity
                    </p>
                  </div>
                  <span className={statusTone[incident.status] || 'badge badge-medium'}>
                    {incident.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <p className="section-kicker">Capacity Signals</p>
          <h3 className="panel-title mt-2">System strain indicators</h3>
          <div className="mt-5 space-y-5">
            {[
              ['Hospital Capacity', dashboardData?.hospitalCapacity || 0, 'bg-sky-500'],
              ['Shelter Occupancy', dashboardData?.shelterOccupancy || 0, 'bg-violet-500'],
            ].map(([label, value, tone]) => (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-600">
                  <span>{label}</span>
                  <span>{value}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[22px] border border-rose-100 bg-rose-50 p-5 text-sm text-rose-900">
            Reports with high severity, blocked access, injuries, or oxygen needs should be routed through the SOS intake immediately so backend triage can prioritize correctly.
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard

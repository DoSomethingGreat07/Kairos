import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import io from 'socket.io-client'
import { getIncidentDetails, SOCKET_BASE_URL } from '../api/client'
import StatusTimeline from './StatusTimeline'
import AssignmentPanel from './AssignmentPanel'

const VictimPanel = () => {
  const { sosId } = useParams()
  const [incident, setIncident] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchIncident = async () => {
      try {
        const data = await getIncidentDetails(sosId)
        setIncident(data)
      } catch (error) {
        console.error('Error fetching incident:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIncident()

    const socket = io(SOCKET_BASE_URL)
    socket.on('incident_update', (data) => {
      if (data.id === sosId) {
        setIncident(data)
      }
    })

    return () => socket.disconnect()
  }, [sosId])

  if (loading) {
    return <div className="panel text-center py-16 text-slate-500">Loading incident details...</div>
  }

  if (!incident) {
    return <div className="panel text-center py-16 text-rose-600">Incident not found.</div>
  }

  return (
    <div className="space-y-6">
      <section className="hero-sos">
        <p className="section-kicker text-rose-100">Victim Status</p>
        <h2 className="mt-2 text-3xl font-black">Emergency Status - SOS #{sosId}</h2>
        <p className="mt-3 max-w-2xl text-sm text-rose-50/90 sm:text-base">
          {incident.latest_message || 'Help is on the way. Stay calm and follow safety instructions from responders.'}
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/15 bg-white/10 p-4">
            <p className="text-sm text-rose-100">Current status</p>
            <p className="mt-2 text-2xl font-black capitalize">{incident.status}</p>
          </div>
          <div className="rounded-[22px] border border-white/15 bg-white/10 p-4">
            <p className="text-sm text-rose-100">Priority score</p>
            <p className="mt-2 text-2xl font-black">{incident.priority_score || 0}</p>
          </div>
          <div className="rounded-[22px] border border-white/15 bg-white/10 p-4">
            <p className="text-sm text-rose-100">Estimated arrival</p>
            <p className="mt-2 text-2xl font-black">{incident.eta || 'TBD'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <AssignmentPanel assignment={incident.assignment} />
        <div className="panel">
          <p className="section-kicker">Timeline</p>
          <h3 className="panel-title mt-2">Incident progress</h3>
          <div className="mt-5">
            <StatusTimeline incident={incident} />
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="section-kicker">Safety Guidance</p>
        <h3 className="panel-title mt-2">Until responders arrive</h3>
        <ul className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <li className="rounded-[20px] bg-slate-50 p-4">Stay in the safest available location away from fire, rising water, debris, or unstable structures.</li>
          <li className="rounded-[20px] bg-slate-50 p-4">Keep your phone battery for emergency communication and location updates.</li>
          <li className="rounded-[20px] bg-slate-50 p-4">Prepare visible signals for responders if exits are blocked or access is poor.</li>
          <li className="rounded-[20px] bg-slate-50 p-4">Follow any instructions sent by dispatchers or arriving responders immediately.</li>
        </ul>
      </section>
    </div>
  )
}

export default VictimPanel

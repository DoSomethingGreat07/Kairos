import React, { useEffect, useState } from 'react'

import { getIncidentDetails, getIncidents, getResponderIncidents } from '../api/client'
import OperationsMap from './OperationsMap'

const IncidentMap = ({ incidents: incidentsProp }) => {
  const [sessionScope] = useState(() => {
    try {
      const session = JSON.parse(window.localStorage.getItem('crisismap_session') || 'null')
      return {
        organizationId: session?.role === 'organization' ? session.subject_id : null,
        responderId: session?.role === 'responder' ? session.subject_id : null,
      }
    } catch {
      return { organizationId: null, responderId: null }
    }
  })
  const [incidents, setIncidents] = useState([])
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [loading, setLoading] = useState(!incidentsProp)

  useEffect(() => {
    if (incidentsProp) {
      setIncidents(incidentsProp)
      setSelectedIncident(incidentsProp[0] || null)
      setLoading(false)
      return undefined
    }

    const fetchIncidents = async () => {
      try {
        const data = sessionScope.responderId
          ? await getResponderIncidents(sessionScope.responderId)
          : await getIncidents(sessionScope.organizationId)
        setIncidents(data)
        if (data[0]) {
          const detail = await getIncidentDetails(data[0].sos_id || data[0].id)
          setSelectedIncident(detail)
        }
      } catch (error) {
        console.error('Error fetching incidents:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIncidents()
    return undefined
  }, [incidentsProp, sessionScope])

  if (loading) {
    return <div className="panel text-center py-16 text-slate-500">Loading operations map...</div>
  }

  return (
    <div className="space-y-5">
      <OperationsMap incident={selectedIncident} incidents={incidents} />
      {incidents.length > 1 && (
        <div className="grid gap-3 md:grid-cols-3">
          {incidents.map((incident) => (
            <button
              key={incident.id}
              type="button"
              onClick={async () => {
                const detail = await getIncidentDetails(incident.sos_id || incident.id)
                setSelectedIncident(detail)
              }}
              className={`rounded-[20px] border p-4 text-left transition ${
                selectedIncident?.id === incident.id
                  ? 'border-cyan-300 bg-cyan-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{incident.zone || 'Unknown zone'}</p>
              <p className="mt-2 text-base font-black capitalize text-slate-950">{incident.disaster_type || 'Emergency'}</p>
              <p className="mt-1 text-sm text-slate-500">{incident.status || 'received'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default IncidentMap

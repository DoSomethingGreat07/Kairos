import React, { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { getIncidents } from '../api/client'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const defaultCenter = [40.7128, -74.006]

const IncidentMap = ({ incidents: incidentsProp }) => {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(!incidentsProp)

  useEffect(() => {
    if (incidentsProp) {
      setIncidents(incidentsProp)
      setLoading(false)
      return undefined
    }

    const fetchIncidents = async () => {
      try {
        const data = await getIncidents()
        setIncidents(data)
      } catch (error) {
        console.error('Error fetching incidents:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIncidents()
    return undefined
  }, [incidentsProp])

  const markers = useMemo(() => incidents.map((incident, index) => ({
    ...incident,
    latitude: incident.latitude || defaultCenter[0] + index * 0.03,
    longitude: incident.longitude || defaultCenter[1] + index * 0.03,
  })), [incidents])

  if (loading) {
    return <div className="panel text-center py-16 text-slate-500">Loading map...</div>
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-100">
      <div className="h-[460px] w-full">
        <MapContainer center={defaultCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {markers.map((incident) => (
            <Marker key={incident.id} position={[incident.latitude, incident.longitude]}>
              <Popup>
                <div className="min-w-[180px]">
                  <h3 className="text-base font-bold capitalize">{incident.disaster_type}</h3>
                  <p>Zone: {incident.zone}</p>
                  <p>Severity: {incident.severity}</p>
                  <p>Status: {incident.status}</p>
                  <p>People: {incident.people_count}</p>
                  {incident.responder?.name && <p>Responder: {incident.responder.name}</p>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}

export default IncidentMap

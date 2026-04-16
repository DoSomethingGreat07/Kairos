import React, { useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Marker, Pane, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import {
  deriveRouteVariants,
  getBlockedSegments,
  getDestinationPoint,
  getIncidentCenter,
  getResponderMarkerPoint,
} from '../utils/incidentVisuals'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const makeDivIcon = (className, glyph) => L.divIcon({
  className: 'leaflet-div-icon-reset',
  html: `<div class="${className}">${glyph}</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

const responderIcon = makeDivIcon('ops-map-marker ops-map-marker-responder', 'R')
const incidentIcon = makeDivIcon('ops-map-marker ops-map-marker-incident', '!')
const destinationIcon = makeDivIcon('ops-map-marker ops-map-marker-destination', '+')

const OperationsMap = ({ incident, incidents = [], simulation = null, compact = false }) => {
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1500)
    return () => window.clearInterval(interval)
  }, [])

  const focalIncident = incident || incidents[0] || null
  const liveIncidents = incidents.length ? incidents : (focalIncident ? [focalIncident] : [])

  const mapModel = useMemo(() => {
    if (!focalIncident) return null
    const routeVariants = deriveRouteVariants(focalIncident, simulation)
    const activeRoute = routeVariants.find((route) => route.isActive) || routeVariants[0]
    return {
      center: getIncidentCenter(focalIncident),
      routeVariants,
      activeRoute,
      blockedSegments: getBlockedSegments(focalIncident),
      responderPoint: getResponderMarkerPoint(focalIncident, activeRoute, simulation, nowMs),
      destination: getDestinationPoint(focalIncident, activeRoute),
    }
  }, [focalIncident, simulation, nowMs])

  if (!mapModel) {
    return <div className="panel text-center py-16 text-slate-500">No live incident available for map display.</div>
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/80 bg-slate-950 shadow-[0_26px_90px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300">Live Operational Map</p>
          <h3 className="mt-1 text-lg font-black">Responder, route, destination, and zone movement</h3>
        </div>
        <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          {simulation?.type ? `Simulation: ${simulation.title}` : 'Live feed'}
        </div>
      </div>

      <div className={compact ? 'h-[360px]' : 'h-[520px]'}>
        <MapContainer center={[mapModel.center.lat, mapModel.center.lng]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={!compact}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <Pane name="zones" style={{ zIndex: 350 }} />
          <Pane name="routes" style={{ zIndex: 420 }} />
          <Pane name="markers" style={{ zIndex: 550 }} />

          {liveIncidents.map((liveIncident) => {
            const center = getIncidentCenter(liveIncident)
            const isFocal = liveIncident.id === focalIncident.id
            return (
              <React.Fragment key={liveIncident.id}>
                <Circle
                  center={[center.lat, center.lng]}
                  radius={isFocal ? 1100 : 650}
                  pathOptions={{
                    color: isFocal ? '#fb7185' : '#fdba74',
                    fillColor: isFocal ? '#fb7185' : '#fdba74',
                    fillOpacity: isFocal ? 0.16 : 0.08,
                    weight: isFocal ? 2.4 : 1.2,
                  }}
                  pane="zones"
                />
                <Marker position={[center.lat, center.lng]} icon={incidentIcon} pane="markers">
                  <Popup>
                    <div className="min-w-[180px]">
                      <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Incident</p>
                      <p className="mt-1 text-sm font-bold capitalize">{liveIncident.disaster_type || 'Emergency'}</p>
                      <p className="text-xs text-slate-500">{liveIncident.zone || 'Unknown zone'}</p>
                    </div>
                  </Popup>
                  {isFocal && <Tooltip direction="top" offset={[0, -16]} opacity={0.95} permanent>Active incident zone</Tooltip>}
                </Marker>
              </React.Fragment>
            )
          })}

          {mapModel.routeVariants.map((route) => (
            route.coordinates?.length > 1 ? (
              <Polyline
                key={route.id}
                positions={route.coordinates.map((point) => [point.lat, point.lng])}
                pathOptions={{
                  color: route.isActive ? '#22d3ee' : '#cbd5e1',
                  weight: route.isActive ? 6 : 4,
                  opacity: route.isActive ? 0.95 : 0.42,
                  dashArray: route.isActive ? undefined : '10 12',
                }}
                pane="routes"
              >
                <Tooltip sticky opacity={0.95}>{`${route.label} • ETA ${route.etaLabel}`}</Tooltip>
              </Polyline>
            ) : null
          ))}

          {mapModel.blockedSegments.map((segment, index) => (
            <Polyline
              key={`${segment.road_id || 'blocked'}-${index}`}
              positions={segment.coordinates.map((point) => [point.lat, point.lng])}
              pathOptions={{ color: '#f43f5e', weight: 4, opacity: 0.9, dashArray: '4 10' }}
              pane="routes"
            >
              <Tooltip sticky opacity={0.95}>Blocked road bypassed</Tooltip>
            </Polyline>
          ))}

          <Marker position={[mapModel.responderPoint.coordinates.lat, mapModel.responderPoint.coordinates.lng]} icon={responderIcon} pane="markers">
            <Popup>
              <div className="min-w-[180px]">
                <p className="text-xs font-bold uppercase tracking-wide text-cyan-600">Responder</p>
                <p className="mt-1 text-sm font-bold">{mapModel.responderPoint.name}</p>
                <p className="text-xs text-slate-500 capitalize">{mapModel.responderPoint.type}</p>
              </div>
            </Popup>
          </Marker>

          <Marker position={[mapModel.destination.coordinates.lat, mapModel.destination.coordinates.lng]} icon={destinationIcon} pane="markers">
            <Popup>
              <div className="min-w-[180px]">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Destination</p>
                <p className="mt-1 text-sm font-bold">{mapModel.destination.name}</p>
                <p className="text-xs capitalize text-slate-500">{mapModel.destination.type}</p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  )
}

export default OperationsMap

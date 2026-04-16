import React, { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const createIcon = (color, label) => L.divIcon({
  className: 'custom-map-marker',
  html: `<div style="
    background:${color};
    width:32px;height:32px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    color:#fff;font-weight:800;font-size:13px;
    box-shadow:0 4px 14px ${color}66;
    border:3px solid #fff;
  ">${label}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const ICONS = {
  incident:  createIcon('#ef4444', '🔴'),
  responder: createIcon('#3b82f6', 'R'),
  hospital:  createIcon('#10b981', 'H'),
  shelter:   createIcon('#8b5cf6', 'S'),
  volunteer: createIcon('#f59e0b', 'V'),
}

const ROUTE_COLORS = {
  primary: '#3b82f6',
  backup1: '#94a3b8',
  backup2: '#cbd5e1',
}

const FitBounds = ({ bounds }) => {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [map, bounds])
  return null
}

const ZONE_COORDS = {
  'zone-a': [40.730, -73.990], 'zone-b': [40.750, -73.970],
  'zone-c': [40.710, -74.010], 'zone-d': [40.720, -73.960],
  'zone-e': [40.740, -74.000], 'zone-f': [40.760, -73.980],
  'zone-g': [40.700, -73.950], 'zone-h': [40.770, -73.960],
}

const resolveCoord = (zoneOrName) => {
  if (!zoneOrName) return null
  const key = String(zoneOrName).toLowerCase().replace(/\s+/g, '-')
  return ZONE_COORDS[key] || null
}

const LiveMap = ({ incident, algorithmResults, showRoutes = true, showBackups = false, highlightedRoute = null }) => {
  const [animOffset, setAnimOffset] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setAnimOffset(prev => (prev + 1) % 100), 80)
    return () => clearInterval(timer)
  }, [])

  const dijkstra = algorithmResults?.dijkstra || {}
  const hungarian = algorithmResults?.hungarian_assignment || {}
  const yenRoutes = algorithmResults?.yen_routes || []
  const volunteers = algorithmResults?.gale_shapley || []

  // Build markers
  const markers = useMemo(() => {
    const list = []

    // Incident location
    const incLat = incident?.latitude || incident?.location?.latitude
    const incLng = incident?.longitude || incident?.location?.longitude
    if (incLat && incLng) {
      list.push({ id: 'incident', pos: [incLat, incLng], icon: ICONS.incident, label: 'SOS Location', info: incident.disaster_type })
    }

    // Destination
    const dest = dijkstra.destination || hungarian.destination
    if (dest) {
      const destCoord = dest.latitude && dest.longitude ? [dest.latitude, dest.longitude] : resolveCoord(dest.id || dest.name)
      if (destCoord) {
        const isHospital = (dest.type || '').toLowerCase().includes('hospital')
        list.push({ id: 'destination', pos: destCoord, icon: isHospital ? ICONS.hospital : ICONS.shelter, label: dest.name || dest.id, info: dest.type })
      }
    }

    // Responder
    if (hungarian.responder_name) {
      const respCoord = hungarian.responder_latitude && hungarian.responder_longitude
        ? [hungarian.responder_latitude, hungarian.responder_longitude]
        : resolveCoord(hungarian.responder_zone || incident?.zone)
      if (respCoord) {
        list.push({ id: 'responder', pos: [respCoord[0] + 0.003, respCoord[1] + 0.002], icon: ICONS.responder, label: hungarian.responder_name, info: hungarian.responder_type })
      }
    }

    // Volunteers
    volunteers.forEach((v, i) => {
      const vCoord = resolveCoord(v.zone || incident?.zone)
      if (vCoord) {
        list.push({ id: `volunteer-${i}`, pos: [vCoord[0] - 0.002 * (i + 1), vCoord[1] + 0.003 * (i + 1)], icon: ICONS.volunteer, label: v.volunteer_name || `Volunteer ${i + 1}`, info: v.rationale })
      }
    })

    return list
  }, [incident, dijkstra, hungarian, volunteers])

  // Build route polylines
  const routes = useMemo(() => {
    const lines = []
    const primaryRoute = dijkstra.route || []
    if (showRoutes && primaryRoute.length > 1) {
      const coords = primaryRoute.map(z => resolveCoord(z)).filter(Boolean)
      if (coords.length > 1) {
        lines.push({ id: 'primary', coords, color: ROUTE_COLORS.primary, weight: 5, dash: null, label: 'Primary Route' })
      }
    }

    if (showBackups && yenRoutes.length > 0) {
      yenRoutes.slice(0, 3).forEach((backup, i) => {
        const bRoute = backup.route || backup.path || []
        if (bRoute.length > 1) {
          const coords = bRoute.map(z => resolveCoord(z)).filter(Boolean)
          if (coords.length > 1) {
            lines.push({ id: `backup-${i}`, coords, color: i === 0 ? ROUTE_COLORS.backup1 : ROUTE_COLORS.backup2, weight: 3, dash: '8 6', label: `Backup ${i + 1}` })
          }
        }
      })
    }

    return lines
  }, [dijkstra, yenRoutes, showRoutes, showBackups])

  // Compute map bounds
  const bounds = useMemo(() => {
    const allCoords = [
      ...markers.map(m => m.pos),
      ...routes.flatMap(r => r.coords),
    ]
    return allCoords.length >= 2 ? allCoords : null
  }, [markers, routes])

  const center = markers[0]?.pos || [40.7128, -74.006]

  if (markers.length === 0) {
    return (
      <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
        No location data available for map visualization
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-100 shadow-sm">
      <div className="relative">
        {/* Legend */}
        <div className="absolute top-3 right-3 z-[1000] rounded-xl bg-white/95 backdrop-blur px-3 py-2 shadow-lg border border-slate-100">
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Incident</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Responder</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Hospital</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Shelter</span>
            {volunteers.length > 0 && <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Volunteer</span>}
          </div>
        </div>

        <div className="h-[420px] w-full">
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            />
            {bounds && <FitBounds bounds={bounds} />}

            {/* Route polylines */}
            {routes.map(route => (
              <Polyline
                key={route.id}
                positions={route.coords}
                pathOptions={{
                  color: highlightedRoute === route.id ? '#f59e0b' : route.color,
                  weight: highlightedRoute === route.id ? 7 : route.weight,
                  dashArray: route.dash,
                  opacity: highlightedRoute && highlightedRoute !== route.id ? 0.4 : 0.9,
                }}
              >
                <Popup><span className="font-semibold text-sm">{route.label}</span></Popup>
              </Polyline>
            ))}

            {/* Zone highlight around incident */}
            {markers[0] && (
              <Circle
                center={markers[0].pos}
                radius={800}
                pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.08, weight: 1, dashArray: '4 4' }}
              />
            )}

            {/* Markers */}
            {markers.map(m => (
              <Marker key={m.id} position={m.pos} icon={m.icon}>
                <Popup>
                  <div className="min-w-[140px]">
                    <p className="font-bold text-sm">{m.label}</p>
                    {m.info && <p className="text-xs text-slate-500 mt-1 capitalize">{m.info}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Route labels overlay */}
        {routes.length > 0 && (
          <div className="absolute bottom-3 left-3 z-[1000] flex gap-2">
            {routes.map(route => (
              <span key={route.id} className="flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-xs font-bold shadow border border-slate-100">
                <span className="h-2 w-2 rounded-full" style={{ background: route.color }} />
                {route.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LiveMap

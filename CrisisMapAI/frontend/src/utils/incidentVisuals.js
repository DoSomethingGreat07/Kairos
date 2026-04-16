const DEFAULT_CENTER = { lat: 41.8781, lng: -87.6298 }

const hashString = (value = '') => {
  let hash = 0
  const source = String(value)
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

export const parseEtaMinutes = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value || '').toLowerCase()
  if (!text || text.includes('no safe route')) return null

  const hourMatch = text.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)/)
  const minuteMatch = text.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/)
  const numericMatch = text.match(/(\d+)/)

  const hours = hourMatch ? Number(hourMatch[1]) : 0
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0
  if (hours || minutes) return (hours * 60) + minutes
  if (numericMatch) return Number(numericMatch[1])
  return null
}

export const formatEtaLabel = (minutes) => {
  if (minutes == null || !Number.isFinite(minutes)) return 'Unavailable'
  if (minutes <= 1) return '< 1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = Math.floor(minutes / 60)
  const remaining = Math.round(minutes % 60)
  if (!remaining) return `${hours} hr`
  return `${hours} hr ${remaining} min`
}

const minuteMs = 60 * 1000

export const getIncidentCenter = (incident = {}) => {
  const latitude = incident.latitude ?? incident.location?.latitude ?? incident.location_resolution?.anchor_latitude
  const longitude = incident.longitude ?? incident.location?.longitude ?? incident.location_resolution?.anchor_longitude
  if (latitude != null && longitude != null) {
    return { lat: Number(latitude), lng: Number(longitude) }
  }
  return DEFAULT_CENTER
}

const zoneOffsetCoordinate = (zoneId, center, radius = 0.06) => {
  const seed = hashString(zoneId || 'zone')
  const angle = (seed % 360) * (Math.PI / 180)
  const magnitude = 0.014 + ((seed % 7) / 7) * radius
  return {
    lat: center.lat + (Math.sin(angle) * magnitude),
    lng: center.lng + (Math.cos(angle) * magnitude),
  }
}

export const getRouteCoordinates = (route = [], incident = {}) => {
  const center = getIncidentCenter(incident)
  if (!Array.isArray(route) || route.length === 0) return [center]

  return route.map((zoneId, index) => {
    if (index === 0) return center
    return zoneOffsetCoordinate(`${zoneId}-${index}`, center)
  })
}

const interpolateBetween = (a, b, progress) => ({
  lat: a.lat + ((b.lat - a.lat) * progress),
  lng: a.lng + ((b.lng - a.lng) * progress),
})

const interpolatePolyline = (points, progress) => {
  if (!points.length) return DEFAULT_CENTER
  if (points.length === 1) return points[0]
  const safe = Math.max(0, Math.min(1, progress))
  const totalSegments = points.length - 1
  const scaled = safe * totalSegments
  const segmentIndex = Math.min(totalSegments - 1, Math.floor(scaled))
  const localProgress = scaled - segmentIndex
  return interpolateBetween(points[segmentIndex], points[segmentIndex + 1], localProgress)
}

const buildRouteVariant = (routeEntry, incident, index, baseEtaMinutes, isPrimary) => {
  const route = routeEntry?.route || routeEntry?.path || []
  const totalTime = routeEntry?.total_time ?? routeEntry?.route_cost ?? baseEtaMinutes ?? null
  const etaMinutes = typeof totalTime === 'number' ? totalTime : (baseEtaMinutes == null ? null : baseEtaMinutes + (index * 4))
  return {
    id: isPrimary ? 'primary' : `backup-${index}`,
    label: isPrimary ? 'Primary' : `Backup ${index}`,
    etaMinutes,
    etaLabel: formatEtaLabel(etaMinutes),
    path: route,
    coordinates: getRouteCoordinates(route, incident),
    explanation: routeEntry?.explanation || '',
  }
}

export const deriveRouteVariants = (incident = {}, simulation = null) => {
  const dijkstra = incident.algorithm_results?.dijkstra || {}
  const yenRoutes = incident.algorithm_results?.yen_routes || []
  const baseEtaMinutes = parseEtaMinutes(incident.eta || dijkstra.eta)
  const variants = []

  if (Array.isArray(dijkstra.route) && dijkstra.route.length > 0) {
    variants.push(buildRouteVariant(
      { route: dijkstra.route, route_cost: dijkstra.route_cost, explanation: dijkstra.explanation },
      incident,
      0,
      baseEtaMinutes,
      true,
    ))
  }

  yenRoutes.slice(0, 2).forEach((routeEntry, index) => {
    variants.push(buildRouteVariant(routeEntry, incident, index + 1, baseEtaMinutes, false))
  })

  const activeIndex = simulation?.type === 'road_blocked' && variants.length > 1 ? 1 : 0
  return variants.map((variant, index) => ({
    ...variant,
    isActive: index === activeIndex,
    statusLabel: index === activeIndex ? 'Live' : 'Standby',
  }))
}

export const getBlockedSegments = (incident = {}) => {
  const dijkstra = incident.algorithm_results?.dijkstra || {}
  const edges = dijkstra.excluded_edges || []
  const center = getIncidentCenter(incident)
  const seen = new Set()

  return edges.reduce((segments, edge, index) => {
    const source = edge.source_zone || edge.from_zone || edge.origin_zone || ''
    const target = edge.target_zone || edge.to_zone || edge.destination_zone || ''
    const roadId = edge.road_id || edge.id || `blocked-${index}`
    const signature = `${roadId}|${source}|${target}`
    if (seen.has(signature)) return segments
    seen.add(signature)

    const humanLabel = source && target
      ? `${source} -> ${target}`
      : roadId !== `blocked-${index}`
        ? `Road segment ${roadId}`
        : 'Unnamed blocked segment'

    segments.push({
      ...edge,
      road_id: roadId,
      source_zone: source || null,
      target_zone: target || null,
      label: humanLabel,
      coordinates: [
        zoneOffsetCoordinate(source || roadId || 'source', center, 0.035),
        zoneOffsetCoordinate(target || roadId || 'target', center, 0.035),
      ],
    })
    return segments
  }, [])
}

export const getDestinationPoint = (incident = {}, activeRoute) => {
  const dijkstra = incident.algorithm_results?.dijkstra || {}
  const destination = dijkstra.destination || incident.assignment?.destination || {}
  const coordinates = activeRoute?.coordinates?.length
    ? activeRoute.coordinates[activeRoute.coordinates.length - 1]
    : getIncidentCenter(incident)
  return {
    name: destination.name || incident.destination?.name || incident.destination || 'Destination pending',
    type: destination.type || incident.destination?.type || 'facility',
    reason: destination.reason || '',
    coordinates,
  }
}

const deriveProgressRatio = (status = 'received', nowMs = Date.now()) => {
  const normalized = String(status).toLowerCase()
  if (normalized === 'resolved' || normalized === 'destination_reached') return 1
  if (normalized === 'transport_started') return 0.78
  if (normalized === 'arrived' || normalized === 'at_scene') return 0.62
  if (normalized === 'en_route') return 0.4 + (((nowMs / 4000) % 1) * 0.22)
  if (normalized === 'assigned' || normalized === 'processed') return 0.18 + (((nowMs / 5000) % 1) * 0.16)
  return 0.05
}

export const getResponderMarkerPoint = (incident = {}, activeRoute, simulation = null, nowMs = Date.now()) => {
  const assignment = incident.algorithm_results?.hungarian_assignment || incident.assignment || {}
  const progress = simulation?.type === 'responder_unavailable'
    ? 0.08
    : deriveProgressRatio(incident.status || assignment.status, nowMs)
  const coordinates = activeRoute?.coordinates?.length ? activeRoute.coordinates : [getIncidentCenter(incident)]
  return {
    coordinates: interpolatePolyline(coordinates, progress),
    progress,
    name: simulation?.type === 'responder_unavailable'
      ? `${assignment.responder_name || incident.responder || 'Assigned unit'} unavailable`
      : (assignment.responder_name || incident.responder || 'Assigned unit'),
    type: assignment.responder_type || 'responder',
  }
}

export const deriveCountdowns = (incident = {}, simulation = null, nowMs = Date.now()) => {
  const routeVariants = deriveRouteVariants(incident, simulation)
  const activeRoute = routeVariants.find((route) => route.isActive) || routeVariants[0]
  const primaryEta = activeRoute?.etaMinutes ?? parseEtaMinutes(incident.eta)
  const startSeed = incident.sos_id || incident.id || 'incident'
  const elapsedMinutes = ((nowMs - (hashString(startSeed) % minuteMs)) / minuteMs) % 7
  const responderEta = primaryEta == null ? null : Math.max(0, primaryEta - elapsedMinutes + (simulation?.etaPenalty || 0))
  const volunteerEta = incident.algorithm_results?.gale_shapley?.[0]?.estimated_arrival
  const volunteerMinutes = parseEtaMinutes(volunteerEta)

  return {
    responderEta,
    transportEta: responderEta == null ? null : responderEta + 8,
    volunteerEta: volunteerMinutes == null ? null : Math.max(0, volunteerMinutes - (elapsedMinutes / 1.6)),
    destinationEta: responderEta == null ? null : responderEta + 14,
  }
}

export const deriveDecisionTrace = (incident = {}, simulation = null) => {
  const priority = incident.algorithm_results?.priority_queue || {}
  const bayesian = incident.algorithm_results?.bayesian_severity || {}
  const assignment = incident.algorithm_results?.hungarian_assignment || incident.assignment || {}
  const dijkstra = incident.algorithm_results?.dijkstra || {}
  const volunteers = incident.algorithm_results?.gale_shapley || []
  const routeVariants = deriveRouteVariants(incident, simulation)
  const activeRoute = routeVariants.find((route) => route.isActive) || routeVariants[0]
  const rejectionReasons = []

  if ((dijkstra.excluded_edges || []).length > 0) rejectionReasons.push('Blocked road segments were rejected by the router.')
  if (assignment.reason) rejectionReasons.push(assignment.reason)
  if (simulation?.type === 'road_blocked') rejectionReasons.push('Primary corridor was deliberately blocked in demo mode, triggering backup route promotion.')
  if (simulation?.type === 'responder_unavailable') rejectionReasons.push('Selected responder was marked unavailable, forcing reassignment logic.')
  if (simulation?.type === 'hospital_full') rejectionReasons.push('Receiving hospital capacity was exhausted, so the dashboard moved to a fallback intake plan.')
  if (simulation?.type === 'shelter_full') rejectionReasons.push('Shelter capacity dropped below intake threshold, requiring re-selection.')

  return [
    {
      title: 'SOS received',
      tone: 'neutral',
      detail: `Incident ingested for ${incident.disaster_type || 'emergency'} in ${incident.zone || 'the affected zone'}.`,
    },
    {
      title: 'Priority scored',
      tone: 'primary',
      detail: priority.explanation || `Priority queue score recorded at ${incident.priority_score ?? priority.score ?? 'N/A'}.`,
    },
    {
      title: 'Severity inferred',
      tone: 'primary',
      detail: bayesian.explanation || `Posterior severity settled at ${bayesian.inferred_severity || incident.severity || 'medium'}.`,
    },
    {
      title: 'Responder candidates evaluated',
      tone: simulation?.type === 'responder_unavailable' ? 'warning' : 'primary',
      detail: assignment.rationale || assignment.explanation || `Best-fit responder selected: ${assignment.responder_name || incident.responder || 'pending assignment'}.`,
    },
    {
      title: activeRoute?.label === 'Primary' ? 'Primary route selected' : 'Backup route activated',
      tone: activeRoute?.label === 'Primary' ? 'primary' : 'warning',
      detail: activeRoute
        ? `${activeRoute.label} route ETA is ${activeRoute.etaLabel}. ${dijkstra.explanation || ''}`.trim()
        : 'No safe route is available.',
    },
    {
      title: 'Destination finalized',
      tone: (simulation?.type === 'hospital_full' || simulation?.type === 'shelter_full') ? 'warning' : 'neutral',
      detail: getDestinationPoint(incident, activeRoute).reason || `Destination selected: ${getDestinationPoint(incident, activeRoute).name}.`,
    },
    {
      title: 'Rejections and constraints',
      tone: rejectionReasons.length ? 'danger' : 'neutral',
      detail: rejectionReasons.length ? rejectionReasons.join(' ') : 'No critical rejections were required for the live plan.',
    },
    {
      title: 'Volunteer and support coordination',
      tone: volunteers.length ? 'success' : 'neutral',
      detail: volunteers.length
        ? `${volunteers.length} volunteer support matches were queued for augmentation.`
        : 'No volunteer augmentation was required for this incident.',
    },
  ]
}

export const deriveTimelineStages = (incident = {}, simulation = null, nowMs = Date.now()) => {
  const status = String(incident.status || '').toLowerCase()
  const countdowns = deriveCountdowns(incident, simulation, nowMs)
  const assignment = incident.algorithm_results?.hungarian_assignment || incident.assignment || {}
  const stageState = (stage) => {
    const order = ['received', 'triaged', 'assigned', 'en_route', 'arrived', 'transport_started', 'destination_reached', 'resolved']
    const current = (() => {
      if (status === 'processed') return 'assigned'
      if (status === 'blocked_access') return 'assigned'
      return status || 'received'
    })()
    const currentIndex = order.indexOf(current)
    const stageIndex = order.indexOf(stage)
    if (stageIndex < 0) return 'pending'
    if (stageIndex < currentIndex) return 'complete'
    if (stageIndex === currentIndex) return 'active'
    return 'pending'
  }

  return [
    { key: 'received', label: 'Alert received', state: stageState('received'), meta: incident.case_events?.[0]?.timestamp || 'Live feed captured' },
    { key: 'triaged', label: 'Triaged', state: stageState('triaged'), meta: incident.inferred_severity || incident.severity || 'Severity pending' },
    { key: 'assigned', label: 'Responder assigned', state: stageState('assigned'), meta: assignment.responder_name || incident.responder || 'Awaiting assignment' },
    { key: 'en_route', label: 'En route', state: stageState('en_route'), meta: countdowns.responderEta == null ? 'Route unavailable' : `${formatEtaLabel(countdowns.responderEta)} to incident` },
    { key: 'arrived', label: 'Arrived at incident', state: stageState('arrived'), meta: countdowns.transportEta == null ? 'Pending' : `Scene stabilization in ${formatEtaLabel(Math.max(0, countdowns.transportEta - countdowns.responderEta))}` },
    { key: 'transport_started', label: 'Transport started', state: stageState('transport_started'), meta: countdowns.destinationEta == null ? 'Pending' : `${formatEtaLabel(countdowns.destinationEta)} to destination` },
    { key: 'destination_reached', label: 'Destination reached', state: stageState('destination_reached'), meta: getDestinationPoint(incident, deriveRouteVariants(incident, simulation).find((route) => route.isActive)).name },
    { key: 'resolved', label: 'Incident resolved', state: stageState('resolved'), meta: simulation?.type ? 'Simulation still active' : 'Awaiting closure' },
  ]
}

export const getSimulationScenarioMeta = (type) => {
  if (type === 'road_blocked') return { title: 'Road blocked', etaPenalty: 6, impact: 'Primary route is cut; backup path becomes live.' }
  if (type === 'responder_unavailable') return { title: 'Responder unavailable', etaPenalty: 9, impact: 'Assigned unit drops out; reassignment is required.' }
  if (type === 'hospital_full') return { title: 'Hospital full', etaPenalty: 5, impact: 'Destination selection shifts to alternative intake.' }
  if (type === 'shelter_full') return { title: 'Shelter exhausted', etaPenalty: 4, impact: 'Shelter capacity forces alternate safe destination.' }
  return null
}

import React, { useState } from 'react'
import LiveMap from './LiveMap'
import { getBlockedSegments } from '../utils/incidentVisuals'

const RouteVisualization = ({ incident, algorithmResults }) => {
  const [selectedRoute, setSelectedRoute] = useState(null)

  const dijkstra = algorithmResults?.dijkstra || {}
  const yenRoutes = algorithmResults?.yen_routes || []
  const blockedSegments = getBlockedSegments({ ...(incident || {}), algorithm_results: algorithmResults || {} })
  const primaryRoute = dijkstra.route || []

  const allRoutes = [
    { id: 'primary', label: 'Primary Route', route: primaryRoute, cost: dijkstra.route_cost, eta: dijkstra.eta, color: '#3b82f6' },
    ...yenRoutes.slice(0, 3).map((backup, i) => ({
      id: `backup-${i}`,
      label: `Backup ${i + 1}`,
      route: backup.route || backup.path || [],
      cost: backup.route_cost || backup.cost,
      eta: backup.eta,
      color: i === 0 ? '#94a3b8' : '#cbd5e1',
    }))
  ].filter(r => r.route.length > 1)

  return (
    <div className="space-y-4">
      {/* Map with routes */}
      <LiveMap
        incident={incident}
        algorithmResults={algorithmResults}
        showRoutes
        showBackups
        highlightedRoute={selectedRoute}
      />

      {/* Route selector cards */}
      {allRoutes.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {allRoutes.map((route) => (
            <button
              key={route.id}
              onClick={() => setSelectedRoute(prev => prev === route.id ? null : route.id)}
              className={`rounded-[20px] p-4 text-left transition-all duration-200 border ${
                selectedRoute === route.id
                  ? 'border-blue-300 bg-blue-50 shadow-md ring-2 ring-blue-200'
                  : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="h-3 w-3 rounded-full" style={{ background: route.color }} />
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{route.label}</span>
              </div>
              <p className="text-xs font-semibold text-slate-700 truncate">{route.route.join(' → ')}</p>
              <div className="mt-2 flex gap-3">
                {route.cost != null && (
                  <span className="text-xs text-slate-500">Cost: <span className="font-bold text-slate-900">{typeof route.cost === 'number' ? route.cost.toFixed(1) : route.cost}</span></span>
                )}
                {route.eta && (
                  <span className="text-xs text-slate-500">ETA: <span className="font-bold text-slate-900">{route.eta}</span></span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Blocked roads notice */}
      {blockedSegments.length > 0 && (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Blocked Roads Detected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {blockedSegments.slice(0, 8).map((edge, i) => (
              <span key={i} className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {edge.label}
              </span>
            ))}
            {blockedSegments.length > 8 && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
                +{blockedSegments.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default RouteVisualization

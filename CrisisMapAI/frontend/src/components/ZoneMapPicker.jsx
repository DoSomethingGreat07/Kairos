import React, { useMemo } from 'react'

const ZoneMapPicker = ({
  zones,
  selectedZones,
  onToggleZone,
  multiSelect = false,
  accent = '#e11d48',
  secondaryAccent = '#0f172a',
}) => {
  const zoneSet = useMemo(() => new Set(selectedZones), [selectedZones])

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <svg viewBox="0 0 100 70" className="w-full">
          {zones.map((zone) => {
            const points = zone.polygon_points.map((point) => `${point.x},${point.y}`).join(' ')
            const selected = zoneSet.has(zone.id)
            return (
              <g key={zone.id}>
                <polygon
                  points={points}
                  fill={selected ? accent : '#ffffff'}
                  stroke={selected ? secondaryAccent : '#94a3b8'}
                  strokeWidth="1.2"
                  className="cursor-pointer transition-opacity hover:opacity-90"
                  onClick={() => onToggleZone(zone.id)}
                />
                <text
                  x={zone.polygon_points.reduce((sum, point) => sum + point.x, 0) / zone.polygon_points.length}
                  y={zone.polygon_points.reduce((sum, point) => sum + point.y, 0) / zone.polygon_points.length}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none fill-slate-800 text-[4px] font-semibold"
                >
                  {zone.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2">
        {zones.map((zone) => {
          const selected = zoneSet.has(zone.id)
          return (
            <button
              key={zone.id}
              type="button"
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                selected ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'
              }`}
              onClick={() => onToggleZone(zone.id)}
            >
              {zone.name}
            </button>
          )
        })}
      </div>
      {multiSelect && <p className="text-xs text-slate-500">Tap multiple zones to add coverage. Frequent zones are limited to 3 selections.</p>}
    </div>
  )
}

export default ZoneMapPicker

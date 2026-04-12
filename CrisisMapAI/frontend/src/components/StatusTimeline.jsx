import React from 'react'

const timelineSteps = [
  { status: 'received', label: 'SOS Received', timeKey: 'created_at' },
  { status: 'prioritized', label: 'Prioritized', timeKey: 'prioritized_at' },
  { status: 'assigned', label: 'Responder Assigned', timeKey: 'assigned_at' },
  { status: 'en_route', label: 'Responder En Route', timeKey: 'en_route_at' },
  { status: 'arrived', label: 'Responder Arrived', timeKey: 'arrived_at' },
]

const StatusTimeline = ({ incident }) => {
  const currentIndex = timelineSteps.findIndex((step) => step.status === incident.status)

  return (
    <div className="space-y-4">
      {timelineSteps.map((step, index) => {
        const isComplete = currentIndex >= index || incident.status === step.status
        return (
          <div key={step.status} className="flex items-start gap-4">
            <div className={`mt-1 h-4 w-4 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            <div>
              <p className="font-semibold text-slate-900">{step.label}</p>
              <p className="text-sm text-slate-500">
                {incident[step.timeKey] ? new Date(incident[step.timeKey]).toLocaleString() : 'Pending'}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default StatusTimeline

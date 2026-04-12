import React from 'react'

const AssignmentPanel = ({ assignment }) => {
  if (!assignment) {
    return <div className="panel text-center py-12 text-slate-500">No assignment data available</div>
  }

  return (
    <div className="panel">
      <p className="section-kicker">Assignment</p>
      <h3 className="panel-title mt-2">Responder match details</h3>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[22px] bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Responder</p>
          <p className="mt-2 text-lg font-bold text-slate-950">{assignment.responder?.name || 'Not assigned'}</p>
          <p className="text-sm text-slate-500">{assignment.responder?.type || 'Responder type pending'}</p>
        </div>
        <div className="rounded-[22px] bg-slate-50 p-4">
          <p className="text-sm text-slate-500">ETA</p>
          <p className="mt-2 text-lg font-bold text-slate-950">{assignment.eta || 'Calculating...'}</p>
        </div>
        <div className="rounded-[22px] bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Route</p>
          <p className="mt-2 text-sm font-medium text-slate-900">{assignment.route?.join(' → ') || 'No route calculated'}</p>
        </div>
        <div className="rounded-[22px] bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Destination</p>
          <p className="mt-2 text-lg font-bold text-slate-950">{assignment.destination?.name || 'Not set'}</p>
          <p className="text-sm text-slate-500">{assignment.destination?.type || ''}</p>
        </div>
      </div>

      {assignment.explanation && (
        <div className="mt-5 rounded-[22px] border border-slate-100 bg-white p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Rationale</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{assignment.explanation}</p>
        </div>
      )}
    </div>
  )
}

export default AssignmentPanel

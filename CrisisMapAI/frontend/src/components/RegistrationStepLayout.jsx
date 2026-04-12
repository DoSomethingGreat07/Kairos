import React from 'react'

const RegistrationStepLayout = ({
  title,
  subtitle,
  currentStep,
  totalSteps,
  onBack,
  onContinue,
  continueLabel,
  continueDisabled,
  canContinue,
  loading,
  onExtraAction,
  extraActionLabel,
  extraActionDisabled,
  children,
}) => {
  const progress = Math.round((currentStep / totalSteps) * 100)
  const resolvedContinueDisabled = continueDisabled ?? (!canContinue || loading)

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-kicker">Registration</p>
            <h2 className="panel-title mt-2">{title}</h2>
            <p className="panel-subtitle">{subtitle}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Required fields are marked with a red Required badge. Optional fields are labeled inline.
            </p>
          </div>
          <div className="min-w-[220px]">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
              <span>Step {currentStep}</span>
              <span>of {totalSteps}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-rose-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        {children}
      </section>

      <section className="sticky bottom-4 z-10">
        <div className="panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="button-soft w-full sm:w-auto" onClick={onBack}>
            Back
          </button>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {onExtraAction && extraActionLabel && (
              <button type="button" className="button-soft w-full sm:w-auto" onClick={onExtraAction} disabled={extraActionDisabled || loading}>
                {extraActionLabel}
              </button>
            )}
            <button type="button" className="button-primary w-full sm:w-auto" onClick={onContinue} disabled={resolvedContinueDisabled}>
              {loading ? 'Processing…' : (continueLabel || 'Continue')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default RegistrationStepLayout

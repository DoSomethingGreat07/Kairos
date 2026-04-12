import React, { useEffect, useMemo, useState } from 'react'
import RegistrationStepLayout from './RegistrationStepLayout'
import ZoneMapPicker from './ZoneMapPicker'
import { getRegistrationDraft, getRegistrationZones, saveRegistrationDraft, saveVictimTier1, saveVictimTier2 } from '../api/client'

const totalSteps = 6
const draftStorageKey = 'crisismap_victim_registration_draft'
const allergyOptions = ['Penicillin', 'Latex', 'Aspirin', 'Sulfa drugs', 'Iodine', 'Peanuts', 'Other']
const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']
const conditionOptions = [
  ['requires_oxygen_or_respiratory_support', 'Requires oxygen or respiratory support'],
  ['diabetes_insulin_dependent', 'Diabetes (insulin-dependent)'],
  ['heart_condition', 'Heart condition'],
  ['mobility_impairment', 'Mobility impairment'],
  ['hearing_impairment', 'Hearing impairment'],
  ['vision_impairment', 'Vision impairment'],
  ['currently_pregnant', 'Currently pregnant'],
  ['immunocompromised', 'Immunocompromised'],
  ['dialysis_dependent', 'Dialysis-dependent'],
  ['ventilator_dependent', 'Ventilator-dependent'],
]
const petOptions = ['Dog', 'Cat', 'Bird', 'Other']
const vehicleTypes = ['Car', 'Motorcycle', 'Truck']
const homeMedicalEquipmentOptions = ['Oxygen concentrator', 'Dialysis machine', 'Home ventilator', 'Insulin pump', 'None']
const relationshipOptions = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Neighbor', 'Other']

const initialState = {
  currentStep: 1,
  draftId: '',
  identity: {
    full_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    preferred_language: typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US',
    profile_photo_url: '',
  },
  location_profile: {
    home_zone: '',
    work_zone: '',
    frequent_zones: [],
  },
  medical_profile: {
    blood_type: 'Unknown',
    allergies: [],
    other_allergy: '',
    medications: '',
    conditions: Object.fromEntries(conditionOptions.map(([key]) => [key, false])),
    home_oxygen_device: false,
  },
  household_profile: {
    household_size: 1,
    children_under_12: 0,
    elderly_members: 0,
    mobility_limited_members: 0,
    has_pets: false,
    pet_types: [],
    pet_count: 0,
    has_vehicle: false,
    vehicle_type: '',
    home_medical_equipment: [],
  },
  emergency_contacts: {
    primary_name: '',
    primary_phone: '',
    primary_relationship: 'Friend',
    secondary_name: '',
    secondary_phone: '',
    secondary_relationship: '',
  },
  consent_preferences: {
    share_location_with_responders: false,
    understands_not_replacement_for_emergency_services: false,
    password: '',
    receive_zone_verification_alerts: false,
    receive_general_zone_alerts: false,
    share_anonymized_incident_data: false,
  },
}

const phonePattern = /^\+?[1-9]\d{6,14}$/

const VictimRegistrationFlow = ({ onBackToRoles }) => {
  const [formState, setFormState] = useState(initialState)
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(false)
  const [screenLoading, setScreenLoading] = useState(true)
  const [error, setError] = useState('')
  const [resumeDraft, setResumeDraft] = useState(null)
  const [completed, setCompleted] = useState(null)

  useEffect(() => {
    const loadZonesAndDraft = async () => {
      try {
        const zoneData = await getRegistrationZones()
        setZones(zoneData)
        const savedDraftId = window.localStorage.getItem(draftStorageKey)
        if (savedDraftId) {
          const draft = await getRegistrationDraft('victim', savedDraftId)
          setResumeDraft(draft)
        }
      } catch (loadError) {
        console.error(loadError)
      } finally {
        setScreenLoading(false)
      }
    }

    loadZonesAndDraft()
  }, [])

  useEffect(() => {
    if (screenLoading || completed) return undefined

    const hasData = JSON.stringify(formState) !== JSON.stringify(initialState)
    if (!hasData) return undefined

    const timer = window.setTimeout(() => {
      saveRegistrationDraft({
        role: 'victim',
        current_step: formState.currentStep,
        draft_data: buildDraftData(formState),
        draft_id: formState.draftId || undefined,
      })
        .then((savedDraft) => {
          window.localStorage.setItem(draftStorageKey, savedDraft.id)
          setFormState((prev) => (prev.draftId === savedDraft.id ? prev : { ...prev, draftId: savedDraft.id }))
        })
        .catch((draftError) => console.error('Autosave failed:', draftError))
    }, 700)

    return () => window.clearTimeout(timer)
  }, [formState, screenLoading, completed])

  const stepValidators = useMemo(() => ({
    1: validateIdentity(formState.identity),
    2: !!formState.location_profile.home_zone,
    3: validateMedical(formState.medical_profile),
    4: validateHousehold(formState.household_profile),
    5: validateContacts(formState.emergency_contacts),
    6: validateConsent(formState.consent_preferences),
  }), [formState])

  const canContinue = stepValidators[formState.currentStep]

  const updateNested = (section, field, value) => {
    setFormState((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }))
  }

  const toggleArrayItem = (section, field, value, allowSingleNone = false) => {
    setFormState((prev) => {
      const current = prev[section][field]
      let next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
      if (allowSingleNone && value === 'None') {
        next = current.includes('None') ? [] : ['None']
      } else if (allowSingleNone) {
        next = next.filter((item) => item !== 'None')
      }
      return {
        ...prev,
        [section]: { ...prev[section], [field]: next },
      }
    })
  }

  const handleHomeZoneToggle = (zoneId) => updateNested('location_profile', 'home_zone', zoneId)
  const handleWorkZoneToggle = (zoneId) => updateNested('location_profile', 'work_zone', formState.location_profile.work_zone === zoneId ? '' : zoneId)
  const handleFrequentZoneToggle = (zoneId) => {
    const current = formState.location_profile.frequent_zones
    if (current.includes(zoneId)) {
      updateNested('location_profile', 'frequent_zones', current.filter((id) => id !== zoneId))
      return
    }
    if (current.length >= 3) return
    updateNested('location_profile', 'frequent_zones', [...current, zoneId])
  }

  const persistDraft = async (currentStepOverride = formState.currentStep) => {
    const savedDraft = await saveRegistrationDraft({
      role: 'victim',
      current_step: currentStepOverride,
      draft_data: buildDraftData(formState),
      draft_id: formState.draftId || undefined,
    })
    window.localStorage.setItem(draftStorageKey, savedDraft.id)
    setFormState((prev) => ({ ...prev, draftId: savedDraft.id }))
    return savedDraft
  }

  const handleContinue = async () => {
    setError('')
    setLoading(true)
    try {
      if (formState.currentStep < totalSteps) {
        const nextStep = formState.currentStep + 1
        if (formState.currentStep === 1) {
          await persistDraft(nextStep)
        } else if (formState.currentStep === 2) {
          await saveVictimTier1({
            draft_id: formState.draftId || undefined,
            current_step: nextStep,
            identity: formState.identity,
            location_profile: formState.location_profile,
          })
        } else {
          await persistDraft(nextStep)
        }
        setFormState((prev) => ({ ...prev, currentStep: nextStep }))
      } else {
        const result = await saveVictimTier2({
          draft_id: formState.draftId || undefined,
          current_step: 6,
          ...buildDraftData(formState),
        })
        window.localStorage.setItem(draftStorageKey, result.draft.id)
        setCompleted(result)
      }
    } catch (submitError) {
      setError(submitError?.response?.data?.detail || 'Unable to continue registration right now.')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = async () => {
    setError('')
    if (formState.currentStep === 1) {
      onBackToRoles()
      return
    }
    await persistDraft(formState.currentStep)
    setFormState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }))
  }

  const restoreDraft = () => {
    if (!resumeDraft?.draft_data) return
    setFormState({
      ...initialState,
      currentStep: Math.min(resumeDraft.current_step || 1, totalSteps),
      draftId: resumeDraft.id,
      ...resumeDraft.draft_data,
    })
    setResumeDraft(null)
  }

  const discardDraft = () => {
    window.localStorage.removeItem(draftStorageKey)
    setResumeDraft(null)
    setFormState(initialState)
  }

  if (screenLoading) {
    return <div className="panel text-center py-16 text-slate-500">Loading registration…</div>
  }

  if (completed) {
    return (
      <div className="space-y-6">
        <section className="panel">
          <p className="section-kicker">Tier 2 complete</p>
          <h2 className="panel-title mt-2">Victim profile registration is active</h2>
          <p className="panel-subtitle">
            Household, medical, emergency contact, consent, and auto-population rules are now stored in Postgres and ready to feed the SOS pipeline.
          </p>
          <div className="mt-5 rounded-[22px] bg-emerald-50 p-4 text-sm text-emerald-800">
            Draft ID: <span className="font-bold">{completed.draft.id}</span>
          </div>
          <button type="button" className="button-primary mt-5" onClick={onBackToRoles}>
            Return to Role Selection
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {resumeDraft && (
        <section className="panel border-rose-100 bg-rose-50/70">
          <p className="section-kicker">Draft found</p>
          <h3 className="panel-title mt-2">Continue your victim registration?</h3>
          <p className="panel-subtitle">We found a saved draft from step {resumeDraft.current_step}. You can continue where you left off or start over.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="button-primary" onClick={restoreDraft}>Continue draft</button>
            <button type="button" className="button-soft" onClick={discardDraft}>Start over</button>
          </div>
        </section>
      )}

      <RegistrationStepLayout
        title={stepTitle(formState.currentStep)}
        subtitle={stepSubtitle(formState.currentStep)}
        currentStep={formState.currentStep}
        totalSteps={totalSteps}
        onBack={handleBack}
        onContinue={handleContinue}
        canContinue={canContinue}
        loading={loading}
      >
        {formState.currentStep === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Full name <span className="badge badge-critical">Required</span></span>
              <input className="input-shell" value={formState.identity.full_name} onChange={(e) => updateNested('identity', 'full_name', e.target.value)} />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">Phone number with country code <span className="badge badge-critical">Required</span></span>
              <input className="input-shell" value={formState.identity.phone} onChange={(e) => updateNested('identity', 'phone', e.target.value)} placeholder="+14155550199" />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">Email (optional)</span>
              <input className="input-shell" type="email" value={formState.identity.email} onChange={(e) => updateNested('identity', 'email', e.target.value)} placeholder="name@example.com" />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">Date of birth <span className="badge badge-critical">Required</span></span>
              <input className="input-shell" type="date" value={formState.identity.date_of_birth} onChange={(e) => updateNested('identity', 'date_of_birth', e.target.value)} />
              <p className="mt-2 text-sm text-slate-500">Registrant must be at least 5 years old.</p>
              {formState.identity.date_of_birth && !validateIdentity(formState.identity) && (
                <p className="mt-2 text-sm text-rose-600">Enter a valid date of birth for someone age 5 or older.</p>
              )}
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">Profile photo URL (optional)</span>
              <input className="input-shell" value={formState.identity.profile_photo_url} onChange={(e) => updateNested('identity', 'profile_photo_url', e.target.value)} placeholder="Optional image URL" />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">Preferred language</span>
              <input className="input-shell" value={formState.identity.preferred_language} onChange={(e) => updateNested('identity', 'preferred_language', e.target.value)} />
            </label>
          </div>
        )}

        {formState.currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-slate-700">Home zone <span className="badge badge-critical">Required</span></p>
              <p className="mt-1 text-sm text-slate-500">We use your zone to send you relevant emergency alerts and to route responders accurately.</p>
              <div className="mt-4">
                <ZoneMapPicker zones={zones} selectedZones={formState.location_profile.home_zone ? [formState.location_profile.home_zone] : []} onToggleZone={handleHomeZoneToggle} />
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
              <p className="text-sm font-semibold text-slate-700">Work zone</p>
              <p className="mt-1 text-sm text-slate-500">Optional.</p>
              <div className="mt-4">
                  <ZoneMapPicker zones={zones} selectedZones={formState.location_profile.work_zone ? [formState.location_profile.work_zone] : []} onToggleZone={handleWorkZoneToggle} accent="#0ea5e9" secondaryAccent="#1e293b" />
                </div>
              </div>
              <div>
              <p className="text-sm font-semibold text-slate-700">Frequently visited zones</p>
              <p className="mt-1 text-sm text-slate-500">Optional, up to 3 zones.</p>
              <div className="mt-4">
                  <ZoneMapPicker zones={zones} selectedZones={formState.location_profile.frequent_zones} onToggleZone={handleFrequentZoneToggle} multiSelect accent="#7c3aed" secondaryAccent="#4c1d95" />
                </div>
              </div>
            </div>
          </div>
        )}

        {formState.currentStep === 3 && (
          <div className="space-y-6">
            <div className="rounded-[20px] border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              This information is only shared with responders assigned to your emergency. It is never sold or shared.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-slate-700">Blood type <span className="badge badge-critical">Required</span></span>
                <select className="input-shell" value={formState.medical_profile.blood_type} onChange={(e) => updateNested('medical_profile', 'blood_type', e.target.value)}>
                  {bloodTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Current medications relevant to emergencies (optional)</span>
                <textarea className="input-shell min-h-[100px]" value={formState.medical_profile.medications} onChange={(e) => updateNested('medical_profile', 'medications', e.target.value)} placeholder="e.g. blood thinners, insulin, seizure medication" />
              </label>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Known allergies</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {allergyOptions.map((option) => {
                  const selected = formState.medical_profile.allergies.includes(option)
                  return (
                    <button key={option} type="button" className={selected ? 'badge badge-high' : 'badge border border-slate-200 bg-white text-slate-600'} onClick={() => toggleArrayItem('medical_profile', 'allergies', option)}>
                      {option}
                    </button>
                  )
                })}
              </div>
              {formState.medical_profile.allergies.includes('Other') && (
                <label className="mt-4 block">
                  <span className="text-sm font-semibold text-slate-700">Other allergy</span>
                  <input className="input-shell" value={formState.medical_profile.other_allergy} onChange={(e) => updateNested('medical_profile', 'other_allergy', e.target.value)} />
                </label>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Medical conditions</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {conditionOptions.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={formState.medical_profile.conditions[key]} onChange={(e) => updateNested('medical_profile', 'conditions', { ...formState.medical_profile.conditions, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={formState.medical_profile.home_oxygen_device} onChange={(e) => updateNested('medical_profile', 'home_oxygen_device', e.target.checked)} />
              Do you have a personal oxygen device at home?
            </label>
          </div>
        )}

        {formState.currentStep === 4 && (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['household_size', 'Total people in household including yourself', 1],
              ['children_under_12', 'Children under 12', 0],
              ['elderly_members', 'Elderly members aged 65 or older', 0],
              ['mobility_limited_members', 'Members with mobility limitations', 0],
            ].map(([field, label, min]) => (
              <label key={field}>
                <span className="text-sm font-semibold text-slate-700">{label}{field === 'household_size' ? ' ' : ''}{field === 'household_size' ? <span className="badge badge-critical">Required</span> : null}</span>
                <input className="input-shell" type="number" min={min} value={formState.household_profile[field]} onChange={(e) => updateNested('household_profile', field, Number(e.target.value))} />
              </label>
            ))}
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
              <input type="checkbox" checked={formState.household_profile.has_pets} onChange={(e) => updateNested('household_profile', 'has_pets', e.target.checked)} />
              Do you have pets?
            </label>
            {formState.household_profile.has_pets && (
              <>
                <div className="md:col-span-2">
                  <p className="text-sm font-semibold text-slate-700">Pet type</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {petOptions.map((option) => {
                      const selected = formState.household_profile.pet_types.includes(option)
                      return (
                        <button key={option} type="button" className={selected ? 'badge badge-medium' : 'badge border border-slate-200 bg-white text-slate-600'} onClick={() => toggleArrayItem('household_profile', 'pet_types', option)}>
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <label>
                  <span className="text-sm font-semibold text-slate-700">Pet count</span>
                  <input className="input-shell" type="number" min="1" value={formState.household_profile.pet_count} onChange={(e) => updateNested('household_profile', 'pet_count', Number(e.target.value))} />
                </label>
              </>
            )}
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
              <input type="checkbox" checked={formState.household_profile.has_vehicle} onChange={(e) => updateNested('household_profile', 'has_vehicle', e.target.checked)} />
              Do you have a personal vehicle?
            </label>
            {formState.household_profile.has_vehicle && (
              <label>
                <span className="text-sm font-semibold text-slate-700">Vehicle type</span>
                <select className="input-shell" value={formState.household_profile.vehicle_type} onChange={(e) => updateNested('household_profile', 'vehicle_type', e.target.value)}>
                  <option value="">Select vehicle type</option>
                  {vehicleTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
            )}
            <div className="md:col-span-2">
              <p className="text-sm font-semibold text-slate-700">Home medical equipment</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {homeMedicalEquipmentOptions.map((option) => {
                  const selected = formState.household_profile.home_medical_equipment.includes(option)
                  return (
                    <button key={option} type="button" className={selected ? 'badge badge-high' : 'badge border border-slate-200 bg-white text-slate-600'} onClick={() => toggleArrayItem('household_profile', 'home_medical_equipment', option, true)}>
                      {option}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {formState.currentStep === 5 && (
          <div className="space-y-6">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Your emergency contacts will receive an SMS when you submit an SOS, including your assigned responder name and destination.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-slate-700">Contact 1 full name <span className="badge badge-critical">Required</span></span>
                <input className="input-shell" value={formState.emergency_contacts.primary_name} onChange={(e) => updateNested('emergency_contacts', 'primary_name', e.target.value)} />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Contact 1 phone number <span className="badge badge-critical">Required</span></span>
                <input className="input-shell" value={formState.emergency_contacts.primary_phone} onChange={(e) => updateNested('emergency_contacts', 'primary_phone', e.target.value)} />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Contact 1 relationship <span className="badge badge-critical">Required</span></span>
                <select className="input-shell" value={formState.emergency_contacts.primary_relationship} onChange={(e) => updateNested('emergency_contacts', 'primary_relationship', e.target.value)}>
                  {relationshipOptions.map((relationship) => <option key={relationship}>{relationship}</option>)}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Contact 2 full name (optional)</span>
                <input className="input-shell" value={formState.emergency_contacts.secondary_name} onChange={(e) => updateNested('emergency_contacts', 'secondary_name', e.target.value)} />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Contact 2 phone number (optional)</span>
                <input className="input-shell" value={formState.emergency_contacts.secondary_phone} onChange={(e) => updateNested('emergency_contacts', 'secondary_phone', e.target.value)} />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Contact 2 relationship (optional)</span>
                <select className="input-shell" value={formState.emergency_contacts.secondary_relationship} onChange={(e) => updateNested('emergency_contacts', 'secondary_relationship', e.target.value)}>
                  <option value="">Optional</option>
                  {relationshipOptions.map((relationship) => <option key={relationship}>{relationship}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        {formState.currentStep === 6 && (
          <div className="space-y-5">
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={formState.consent_preferences.share_location_with_responders} onChange={(e) => updateNested('consent_preferences', 'share_location_with_responders', e.target.checked)} />
                <span>
                  Share my location with responders during emergencies. <span className="badge badge-critical">Required</span>
                  <span className="mt-1 block text-xs font-normal text-slate-500">Responders use your exact location to navigate to you faster.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={formState.consent_preferences.understands_not_replacement_for_emergency_services} onChange={(e) => updateNested('consent_preferences', 'understands_not_replacement_for_emergency_services', e.target.checked)} />
                <span>I understand this app does not replace calling emergency services. <span className="badge badge-critical">Required</span></span>
              </label>
            </div>
            <label>
              <span className="text-sm font-semibold text-slate-700">Create password <span className="badge badge-critical">Required</span></span>
              <input className="input-shell" type="password" value={formState.consent_preferences.password} onChange={(e) => updateNested('consent_preferences', 'password', e.target.value)} placeholder="Minimum 8 characters" />
            </label>
            <div className="grid gap-3">
              {[
                ['receive_zone_verification_alerts', 'Receive alerts when emergencies are reported in my zone and help verify them'],
                ['receive_general_zone_alerts', 'Receive general emergency alerts for my zone'],
                ['share_anonymized_incident_data', 'Share anonymized incident data to improve response accuracy'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={formState.consent_preferences[key]} onChange={(e) => updateNested('consent_preferences', key, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div className="mt-5 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      </RegistrationStepLayout>
    </div>
  )
}

const buildDraftData = (state) => ({
  identity: state.identity,
  location_profile: state.location_profile,
  medical_profile: state.medical_profile,
  household_profile: state.household_profile,
  emergency_contacts: state.emergency_contacts,
  consent_preferences: state.consent_preferences,
})

const validateIdentity = (identity) => {
  if (identity.full_name.trim().length < 2) return false
  if (!phonePattern.test(identity.phone.trim())) return false
  if (!identity.date_of_birth) return false
  const dob = new Date(identity.date_of_birth)
  const today = new Date()
  const age = today.getFullYear() - dob.getFullYear() - (
    today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
  )
  return age >= 5
}

const validateMedical = (medicalProfile) => {
  if (!medicalProfile.blood_type) return false
  if (medicalProfile.allergies.includes('Other') && !medicalProfile.other_allergy.trim()) return false
  return true
}

const validateHousehold = (householdProfile) => {
  if (householdProfile.household_size < 1) return false
  if (householdProfile.children_under_12 < 0 || householdProfile.elderly_members < 0 || householdProfile.mobility_limited_members < 0) return false
  if (householdProfile.has_pets && (householdProfile.pet_count < 1 || householdProfile.pet_types.length === 0)) return false
  if (householdProfile.has_vehicle && !householdProfile.vehicle_type) return false
  return true
}

const validateContacts = (contacts) => {
  if (contacts.primary_name.trim().length < 2) return false
  if (!phonePattern.test(contacts.primary_phone.trim())) return false
  if (!contacts.primary_relationship) return false
  if (contacts.secondary_name.trim() || contacts.secondary_phone.trim() || contacts.secondary_relationship) {
    if (contacts.secondary_name.trim().length < 2) return false
    if (!phonePattern.test(contacts.secondary_phone.trim())) return false
    if (!contacts.secondary_relationship) return false
  }
  return true
}

const validateConsent = (consent) => (
  consent.share_location_with_responders && consent.understands_not_replacement_for_emergency_services && (consent.password || '').length >= 8
)

const stepTitle = (step) => ({
  1: 'Victim Registration — Identity',
  2: 'Victim Registration — Location Profile',
  3: 'Victim Registration — Medical Profile',
  4: 'Victim Registration — Household Profile',
  5: 'Victim Registration — Emergency Contacts',
  6: 'Victim Registration — Consent and Preferences',
}[step])

const stepSubtitle = (step) => ({
  1: 'Collect identity information that feeds directly into victim profile, login, contact, and language-aware emergency messaging.',
  2: 'Select home and service-relevant zones on the map so routing and alert relevance use real geographic context.',
  3: 'Medical defaults from this step are automatically applied to future SOS reports and shared only with assigned responders.',
  4: 'Household counts and equipment here automatically strengthen SOS prioritization during real incidents.',
  5: 'Registered emergency contacts receive outbound notifications when an SOS is submitted and when a responder is assigned.',
  6: 'Consent and alert preferences control how the system shares location, sends alerts, and uses anonymized data.',
}[step])

export default VictimRegistrationFlow

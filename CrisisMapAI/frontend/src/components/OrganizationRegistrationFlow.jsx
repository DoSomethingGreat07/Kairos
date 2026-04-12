import React, { useEffect, useMemo, useState } from 'react'
import RegistrationStepLayout from './RegistrationStepLayout'
import ZoneMapPicker from './ZoneMapPicker'
import { approveOrganization, getRegistrationDraft, getRegistrationZones, saveOrganizationRegistration, saveRegistrationDraft } from '../api/client'

const totalSteps = 5
const draftStorageKey = 'crisismap_organization_registration_draft'
const orgTypeOptions = [
  'Government Emergency Services',
  'Hospital or Medical Center',
  'Fire Department',
  'NGO or Relief Organization',
  'Private Medical Service',
  'Civil Defense',
  'Red Cross or Red Crescent',
  'Other',
]
const vehicleTypes = ['Ambulance', 'Advanced Medical Unit', 'Fire Truck', 'Rescue Vehicle', 'Helicopter', 'Bus', 'Boat', 'Drone Unit']
const vehicleEquipmentOptions = ['Oxygen system', 'Defibrillator', 'Stretcher', 'Ventilator', 'Fire suppression equipment', 'Water rescue kit', 'Hazmat kit']
const fuelTypes = ['Diesel', 'Petrol', 'Electric', 'Hybrid']
const medicationUnits = ['boxes', 'vials', 'packs', 'units']

const makeOrgCode = () => `ORG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

const createEmptyVehicle = () => ({
  vehicle_type: 'Ambulance',
  vehicle_identifier: '',
  passenger_capacity: 1,
  equipment: [],
  fuel_type: 'Diesel',
  operational_range_km: 50,
  currently_operational: true,
  home_zone: '',
})

const createEmptyShelter = () => ({
  shelter_name: '',
  address: '',
  zone: '',
  total_capacity: 50,
  accepts_pets: false,
  has_medical_bay: false,
  has_backup_power_generator: false,
  currently_operational: true,
})

const initialState = {
  currentStep: 1,
  draftId: '',
  organization_code: makeOrgCode(),
  identity: {
    organization_name: '',
    organization_type: orgTypeOptions[0],
    registration_number: '',
    primary_contact_name: '',
    primary_contact_phone: '',
    primary_contact_email: '',
    logo_url: '',
  },
  coverage: {
    headquarters_zone: '',
    coverage_zones: [],
    years_of_operation: 0,
    operates_24_7: true,
    operating_hours: {},
  },
  equipment_inventory: {
    vehicles: [],
    oxygen_cylinders: 0,
    first_aid_kits: 0,
    stretchers: 0,
    wheelchairs: 0,
    blood_inventory: { 'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0, 'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0 },
    medications: [],
    operates_shelters: false,
    shelters: [],
    communication: {
      radio_available: false,
      radio_frequency: '',
      satellite_phone_available: false,
      mobile_command_vehicle_available: false,
    },
  },
  responder_roster: {
    invite_emails: [],
    pending_email: '',
  },
  authorization: {
    proof_of_registration_url: '',
    authorized_signatory_name: '',
    authorized_signatory_title: '',
    password: '',
    agree_data_sharing: false,
    agree_operational_guidelines: false,
  },
}

const OrganizationRegistrationFlow = ({ onBackToRoles }) => {
  const [formState, setFormState] = useState(initialState)
  const [zones, setZones] = useState([])
  const [screenLoading, setScreenLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resumeDraft, setResumeDraft] = useState(null)
  const [completed, setCompleted] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const zoneData = await getRegistrationZones()
        setZones(zoneData)
        const savedDraftId = window.localStorage.getItem(draftStorageKey)
        if (savedDraftId) {
          const draft = await getRegistrationDraft('organization', savedDraftId)
          setResumeDraft(draft)
        }
      } catch (loadError) {
        console.error(loadError)
      } finally {
        setScreenLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (screenLoading || completed) return undefined
    const hasData = JSON.stringify(formState) !== JSON.stringify(initialState)
    if (!hasData) return undefined
    const timer = window.setTimeout(() => {
      saveRegistrationDraft({
        role: 'organization',
        current_step: formState.currentStep,
        draft_data: buildDraftData(formState),
        draft_id: formState.draftId || undefined,
      })
        .then((draft) => {
          window.localStorage.setItem(draftStorageKey, draft.id)
          setFormState((prev) => (prev.draftId === draft.id ? prev : { ...prev, draftId: draft.id }))
        })
        .catch((draftError) => console.error('Org autosave failed:', draftError))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [formState, screenLoading, completed])

  const canContinue = useMemo(() => validateOrganizationStep(formState), [formState])

  const updateNested = (section, field, value) => {
    setFormState((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }))
  }

  const toggleCoverageZone = (zoneId) => {
    setFormState((prev) => {
      const zonesList = prev.coverage.coverage_zones
      return {
        ...prev,
        coverage: {
          ...prev.coverage,
          coverage_zones: zonesList.includes(zoneId) ? zonesList.filter((id) => id !== zoneId) : [...zonesList, zoneId],
        },
      }
    })
  }

  const updateVehicle = (index, field, value) => {
    setFormState((prev) => {
      const next = [...prev.equipment_inventory.vehicles]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, equipment_inventory: { ...prev.equipment_inventory, vehicles: next } }
    })
  }

  const toggleVehicleEquipment = (index, value) => {
    setFormState((prev) => {
      const next = [...prev.equipment_inventory.vehicles]
      const current = next[index].equipment
      next[index] = {
        ...next[index],
        equipment: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
      }
      return { ...prev, equipment_inventory: { ...prev.equipment_inventory, vehicles: next } }
    })
  }

  const addVehicle = () => setFormState((prev) => ({ ...prev, equipment_inventory: { ...prev.equipment_inventory, vehicles: [...prev.equipment_inventory.vehicles, createEmptyVehicle()] } }))
  const removeVehicle = (index) => setFormState((prev) => ({ ...prev, equipment_inventory: { ...prev.equipment_inventory, vehicles: prev.equipment_inventory.vehicles.filter((_, vehicleIndex) => vehicleIndex !== index) } }))

  const updateShelter = (index, field, value) => {
    setFormState((prev) => {
      const next = [...prev.equipment_inventory.shelters]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, equipment_inventory: { ...prev.equipment_inventory, shelters: next } }
    })
  }

  const addShelter = () => setFormState((prev) => ({ ...prev, equipment_inventory: { ...prev.equipment_inventory, shelters: [...prev.equipment_inventory.shelters, createEmptyShelter()] } }))
  const removeShelter = (index) => setFormState((prev) => ({ ...prev, equipment_inventory: { ...prev.equipment_inventory, shelters: prev.equipment_inventory.shelters.filter((_, shelterIndex) => shelterIndex !== index) } }))

  const addInvite = () => {
    const email = formState.responder_roster.pending_email.trim()
    if (!email) return
    setFormState((prev) => ({
      ...prev,
      responder_roster: {
        invite_emails: [...prev.responder_roster.invite_emails, email],
        pending_email: '',
      },
    }))
  }

  const removeInvite = (email) => {
    setFormState((prev) => ({
      ...prev,
      responder_roster: {
        ...prev.responder_roster,
        invite_emails: prev.responder_roster.invite_emails.filter((invite) => invite !== email),
      },
    }))
  }

  const persistDraft = async () => {
    const draft = await saveRegistrationDraft({
      role: 'organization',
      current_step: formState.currentStep,
      draft_data: buildDraftData(formState),
      draft_id: formState.draftId || undefined,
    })
    window.localStorage.setItem(draftStorageKey, draft.id)
    setFormState((prev) => ({ ...prev, draftId: draft.id }))
    return draft
  }

  const handleContinue = async () => {
    setError('')
    setLoading(true)
    try {
      if (formState.currentStep < totalSteps) {
        await persistDraft()
        setFormState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }))
      } else {
        const result = await saveOrganizationRegistration({
          draft_id: formState.draftId || undefined,
          current_step: 5,
          ...buildDraftData(formState),
        })
        window.localStorage.setItem(draftStorageKey, result.draft.id)
        setCompleted(result)
      }
    } catch (submitError) {
      setError(submitError?.response?.data?.detail || 'Unable to continue organization registration.')
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
    await persistDraft()
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

  if (screenLoading) return <div className="panel text-center py-16 text-slate-500">Loading organization registration…</div>

  if (completed) {
    return (
      <section className="panel space-y-4">
        <p className="section-kicker">Pending verification</p>
        <h2 className="panel-title mt-2">Organization submitted for review</h2>
        <p className="panel-subtitle">An administrator will review your registration proof before activating your organization code and resources. Estimated review time: 1 business day.</p>
        <div className="rounded-[22px] bg-amber-50 p-4 text-sm text-amber-800">
          Organization code: <span className="font-bold">{completed.organization_code}</span>
        </div>
        <button type="button" className="button-primary" onClick={async () => {
          const approved = await approveOrganization(completed.id)
          setCompleted((prev) => ({ ...prev, ...approved }))
        }}>
          {completed.organization_code_active ? 'Organization Approved' : 'Approve for local demo'}
        </button>
        <button type="button" className="button-primary" onClick={onBackToRoles}>Return to Role Selection</button>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {resumeDraft && (
        <section className="panel border-rose-100 bg-rose-50/70">
          <p className="section-kicker">Draft found</p>
          <h3 className="panel-title mt-2">Continue your organization registration?</h3>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="button-primary" onClick={restoreDraft}>Continue draft</button>
            <button type="button" className="button-soft" onClick={discardDraft}>Start over</button>
          </div>
        </section>
      )}

      <RegistrationStepLayout
        title={organizationStepTitle(formState.currentStep)}
        subtitle={organizationStepSubtitle(formState.currentStep)}
        currentStep={formState.currentStep}
        totalSteps={totalSteps}
        onBack={handleBack}
        onContinue={handleContinue}
        canContinue={canContinue}
        loading={loading}
      >
        {formState.currentStep === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2"><span className="text-sm font-semibold text-slate-700">Organization name <span className="badge badge-critical">Required</span></span><input className="input-shell" value={formState.identity.organization_name} onChange={(e) => updateNested('identity', 'organization_name', e.target.value)} /></label>
            <label><span className="text-sm font-semibold text-slate-700">Organization type <span className="badge badge-critical">Required</span></span><select className="input-shell" value={formState.identity.organization_type} onChange={(e) => updateNested('identity', 'organization_type', e.target.value)}>{orgTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label><span className="text-sm font-semibold text-slate-700">Official registration number <span className="badge badge-critical">Required</span></span><input className="input-shell" value={formState.identity.registration_number} onChange={(e) => updateNested('identity', 'registration_number', e.target.value)} /></label>
            <label><span className="text-sm font-semibold text-slate-700">Primary contact person name <span className="badge badge-critical">Required</span></span><input className="input-shell" value={formState.identity.primary_contact_name} onChange={(e) => updateNested('identity', 'primary_contact_name', e.target.value)} /></label>
            <label><span className="text-sm font-semibold text-slate-700">Primary contact phone <span className="badge badge-critical">Required</span></span><input className="input-shell" value={formState.identity.primary_contact_phone} onChange={(e) => updateNested('identity', 'primary_contact_phone', e.target.value)} /></label>
            <label><span className="text-sm font-semibold text-slate-700">Primary contact email</span><input className="input-shell" type="email" value={formState.identity.primary_contact_email} onChange={(e) => updateNested('identity', 'primary_contact_email', e.target.value)} placeholder="Optional email for updates" /></label>
            <label><span className="text-sm font-semibold text-slate-700">Organization logo URL (optional)</span><input className="input-shell" value={formState.identity.logo_url} onChange={(e) => updateNested('identity', 'logo_url', e.target.value)} placeholder="Optional image URL" /></label>
          </div>
        )}

        {formState.currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-slate-700">Headquarters zone <span className="badge badge-critical">Required</span></p>
              <div className="mt-4"><ZoneMapPicker zones={zones} selectedZones={formState.coverage.headquarters_zone ? [formState.coverage.headquarters_zone] : []} onToggleZone={(zoneId) => updateNested('coverage', 'headquarters_zone', zoneId)} /></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Coverage zones <span className="badge badge-critical">Required</span></p>
              <div className="mt-4"><ZoneMapPicker zones={zones} selectedZones={formState.coverage.coverage_zones} onToggleZone={toggleCoverageZone} multiSelect accent="#0f766e" secondaryAccent="#134e4a" /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label><span className="text-sm font-semibold text-slate-700">Years of operation</span><input className="input-shell" type="number" min="0" value={formState.coverage.years_of_operation} onChange={(e) => updateNested('coverage', 'years_of_operation', Number(e.target.value))} /></label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={formState.coverage.operates_24_7} onChange={(e) => updateNested('coverage', 'operates_24_7', e.target.checked)} />Is this organization operational 24 hours 7 days a week?</label>
            </div>
          </div>
        )}

        {formState.currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Vehicles</p>
                  <p className="text-sm text-slate-500">Every operational vehicle becomes a resource after verification.</p>
                </div>
                <button type="button" className="button-soft" onClick={addVehicle}>Add Vehicle</button>
              </div>
              <div className="mt-4 space-y-4">
                {formState.equipment_inventory.vehicles.map((vehicle, index) => (
                  <div key={`${vehicle.vehicle_identifier}-${index}`} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-semibold text-slate-800">Vehicle {index + 1}</p>
                      {formState.equipment_inventory.vehicles.length > 1 && <button type="button" className="text-sm font-semibold text-rose-600" onClick={() => removeVehicle(index)}>Remove</button>}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label><span className="text-sm font-semibold text-slate-700">Vehicle type</span><select className="input-shell" value={vehicle.vehicle_type} onChange={(e) => updateVehicle(index, 'vehicle_type', e.target.value)}>{vehicleTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                      <label><span className="text-sm font-semibold text-slate-700">Vehicle ID or plate number</span><input className="input-shell" value={vehicle.vehicle_identifier} onChange={(e) => updateVehicle(index, 'vehicle_identifier', e.target.value)} /></label>
                      <label><span className="text-sm font-semibold text-slate-700">Passenger capacity</span><input className="input-shell" type="number" min="0" value={vehicle.passenger_capacity} onChange={(e) => updateVehicle(index, 'passenger_capacity', Number(e.target.value))} /></label>
                      <label><span className="text-sm font-semibold text-slate-700">Fuel type</span><select className="input-shell" value={vehicle.fuel_type} onChange={(e) => updateVehicle(index, 'fuel_type', e.target.value)}>{fuelTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                      <label><span className="text-sm font-semibold text-slate-700">Operational range (km)</span><input className="input-shell" type="number" min="0" value={vehicle.operational_range_km} onChange={(e) => updateVehicle(index, 'operational_range_km', Number(e.target.value))} /></label>
                      <label><span className="text-sm font-semibold text-slate-700">Assigned home zone</span><select className="input-shell" value={vehicle.home_zone} onChange={(e) => updateVehicle(index, 'home_zone', e.target.value)}><option value="">Select zone</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
                    </div>
                    <label className="mt-4 flex items-center gap-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={vehicle.currently_operational} onChange={(e) => updateVehicle(index, 'currently_operational', e.target.checked)} />Currently operational</label>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {vehicleEquipmentOptions.map((option) => {
                        const selected = vehicle.equipment.includes(option)
                        return <button key={option} type="button" className={selected ? 'badge badge-high' : 'badge border border-slate-200 bg-white text-slate-600'} onClick={() => toggleVehicleEquipment(index, option)}>{option}</button>
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['oxygen_cylinders', 'Oxygen cylinders'],
                ['first_aid_kits', 'First aid kits'],
                ['stretchers', 'Stretchers'],
                ['wheelchairs', 'Wheelchairs'],
              ].map(([field, label]) => (
                <label key={field}><span className="text-sm font-semibold text-slate-700">{label}</span><input className="input-shell" type="number" min="0" value={formState.equipment_inventory[field]} onChange={(e) => updateNested('equipment_inventory', field, Number(e.target.value))} /></label>
              ))}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700">Blood inventory</p>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {Object.entries(formState.equipment_inventory.blood_inventory).map(([type, qty]) => (
                  <label key={type}><span className="text-sm font-semibold text-slate-700">{type}</span><input className="input-shell" type="number" min="0" value={qty} onChange={(e) => updateNested('equipment_inventory', 'blood_inventory', { ...formState.equipment_inventory.blood_inventory, [type]: Number(e.target.value) })} /></label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Medications</p>
                <button type="button" className="button-soft" onClick={() => updateNested('equipment_inventory', 'medications', [...formState.equipment_inventory.medications, { name: '', quantity: 0, unit: medicationUnits[0] }])}>Add Medication</button>
              </div>
              <div className="mt-3 space-y-3">
                {formState.equipment_inventory.medications.map((medication, index) => (
                  <div key={`${medication.name}-${index}`} className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.7fr_auto]">
                    <input className="input-shell" placeholder="Medication name" value={medication.name} onChange={(e) => {
                      const next = [...formState.equipment_inventory.medications]
                      next[index] = { ...next[index], name: e.target.value }
                      updateNested('equipment_inventory', 'medications', next)
                    }} />
                    <input className="input-shell" type="number" min="0" value={medication.quantity} onChange={(e) => {
                      const next = [...formState.equipment_inventory.medications]
                      next[index] = { ...next[index], quantity: Number(e.target.value) }
                      updateNested('equipment_inventory', 'medications', next)
                    }} />
                    <select className="input-shell" value={medication.unit} onChange={(e) => {
                      const next = [...formState.equipment_inventory.medications]
                      next[index] = { ...next[index], unit: e.target.value }
                      updateNested('equipment_inventory', 'medications', next)
                    }}>{medicationUnits.map((unit) => <option key={unit}>{unit}</option>)}</select>
                    <button type="button" className="text-sm font-semibold text-rose-600" onClick={() => updateNested('equipment_inventory', 'medications', formState.equipment_inventory.medications.filter((_, medicationIndex) => medicationIndex !== index))}>Remove</button>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={formState.equipment_inventory.operates_shelters} onChange={(e) => updateNested('equipment_inventory', 'operates_shelters', e.target.checked)} />
              Does your organization operate shelters?
            </label>

            {formState.equipment_inventory.operates_shelters && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Shelters</p>
                  <button type="button" className="button-soft" onClick={addShelter}>Add Shelter</button>
                </div>
                {formState.equipment_inventory.shelters.map((shelter, index) => (
                  <div key={`${shelter.shelter_name}-${index}`} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-semibold text-slate-800">Shelter {index + 1}</p>
                      <button type="button" className="text-sm font-semibold text-rose-600" onClick={() => removeShelter(index)}>Remove</button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label><span className="text-sm font-semibold text-slate-700">Shelter name</span><input className="input-shell" value={shelter.shelter_name} onChange={(e) => updateShelter(index, 'shelter_name', e.target.value)} /></label>
                      <label><span className="text-sm font-semibold text-slate-700">Address</span><input className="input-shell" value={shelter.address} onChange={(e) => updateShelter(index, 'address', e.target.value)} /></label>
                      <label><span className="text-sm font-semibold text-slate-700">Zone</span><select className="input-shell" value={shelter.zone} onChange={(e) => updateShelter(index, 'zone', e.target.value)}><option value="">Select zone</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
                      <label><span className="text-sm font-semibold text-slate-700">Total capacity</span><input className="input-shell" type="number" min="0" value={shelter.total_capacity} onChange={(e) => updateShelter(index, 'total_capacity', Number(e.target.value))} /></label>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        ['accepts_pets', 'Accepts pets'],
                        ['has_medical_bay', 'Has medical bay'],
                        ['has_backup_power_generator', 'Has backup power generator'],
                        ['currently_operational', 'Currently operational'],
                      ].map(([field, label]) => (
                        <label key={field} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                          <input type="checkbox" checked={shelter[field]} onChange={(e) => updateShelter(index, field, e.target.checked)} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={formState.equipment_inventory.communication.radio_available} onChange={(e) => updateNested('equipment_inventory', 'communication', { ...formState.equipment_inventory.communication, radio_available: e.target.checked })} />Radio communication available</label>
              {formState.equipment_inventory.communication.radio_available && <label><span className="text-sm font-semibold text-slate-700">Radio frequency</span><input className="input-shell" value={formState.equipment_inventory.communication.radio_frequency} onChange={(e) => updateNested('equipment_inventory', 'communication', { ...formState.equipment_inventory.communication, radio_frequency: e.target.value })} /></label>}
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={formState.equipment_inventory.communication.satellite_phone_available} onChange={(e) => updateNested('equipment_inventory', 'communication', { ...formState.equipment_inventory.communication, satellite_phone_available: e.target.checked })} />Satellite phone available</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={formState.equipment_inventory.communication.mobile_command_vehicle_available} onChange={(e) => updateNested('equipment_inventory', 'communication', { ...formState.equipment_inventory.communication, mobile_command_vehicle_available: e.target.checked })} />Mobile command vehicle available</label>
            </div>
          </div>
        )}

        {formState.currentStep === 4 && (
          <div className="space-y-6">
            <div className="rounded-[22px] border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-800">
              Responders register using your organization code. You can add their emails now to send invitations, or share the code directly.
            </div>
            <div className="rounded-[24px] bg-slate-950 p-6 text-white">
              <p className="section-kicker text-slate-300">Organization code</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-3xl font-black tracking-[0.18em]">{formState.organization_code}</p>
                <button type="button" className="button-soft bg-white text-slate-900" onClick={() => navigator.clipboard?.writeText(formState.organization_code)}>Copy Code</button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input className="input-shell" type="email" value={formState.responder_roster.pending_email} onChange={(e) => updateNested('responder_roster', 'pending_email', e.target.value)} placeholder="responder@org.com" />
                <button type="button" className="button-primary whitespace-nowrap" onClick={addInvite}>Add Responder</button>
              </div>
              <p className="text-sm text-slate-500">Optional. Responders can also register later with the organization code.</p>
              <div className="flex flex-wrap gap-2">
                {formState.responder_roster.invite_emails.map((email) => (
                  <button key={email} type="button" className="badge badge-medium" onClick={() => removeInvite(email)}>
                    {email} ×
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {formState.currentStep === 5 && (
          <div className="space-y-5">
            <label>
              <span className="text-sm font-semibold text-slate-700">Proof of registration document URL</span>
              <input className="input-shell" value={formState.authorization.proof_of_registration_url} onChange={(e) => updateNested('authorization', 'proof_of_registration_url', e.target.value)} placeholder="Optional PDF or image URL" />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label><span className="text-sm font-semibold text-slate-700">Authorized signatory full name <span className="badge badge-critical">Required</span></span><input className="input-shell" value={formState.authorization.authorized_signatory_name} onChange={(e) => updateNested('authorization', 'authorized_signatory_name', e.target.value)} /></label>
              <label><span className="text-sm font-semibold text-slate-700">Authorized signatory designation or title</span><input className="input-shell" value={formState.authorization.authorized_signatory_title} onChange={(e) => updateNested('authorization', 'authorized_signatory_title', e.target.value)} /></label>
            </div>
            <label>
              <span className="text-sm font-semibold text-slate-700">Create password <span className="badge badge-critical">Required</span></span>
              <input className="input-shell" type="password" value={formState.authorization.password} onChange={(e) => updateNested('authorization', 'password', e.target.value)} placeholder="Minimum 8 characters" />
            </label>
            <div className="grid gap-3">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={formState.authorization.agree_data_sharing} onChange={(e) => updateNested('authorization', 'agree_data_sharing', e.target.checked)} />Agree to data sharing agreement <span className="badge badge-critical">Required</span></label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={formState.authorization.agree_operational_guidelines} onChange={(e) => updateNested('authorization', 'agree_operational_guidelines', e.target.checked)} />Agree to operational guidelines <span className="badge badge-critical">Required</span></label>
            </div>
          </div>
        )}

        {error && <div className="mt-5 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      </RegistrationStepLayout>
    </div>
  )
}

const buildDraftData = (state) => ({
  organization_code: state.organization_code,
  identity: state.identity,
  coverage: state.coverage,
  equipment_inventory: state.equipment_inventory,
  responder_roster: { invite_emails: state.responder_roster.invite_emails },
  authorization: state.authorization,
})

const validateOrganizationStep = (state) => {
  if (state.currentStep === 1) {
    const identity = state.identity
    return Boolean(identity.organization_name && identity.organization_type && identity.registration_number && identity.primary_contact_name && identity.primary_contact_phone)
  }
  if (state.currentStep === 2) {
    return Boolean(state.coverage.headquarters_zone && state.coverage.coverage_zones.length > 0)
  }
  if (state.currentStep === 3) {
    const allVehiclesValid = state.equipment_inventory.vehicles.every((vehicle) => {
      const hasAnyVehicleData = Boolean(
        vehicle.vehicle_identifier
        || vehicle.home_zone
        || (vehicle.equipment && vehicle.equipment.length > 0)
      )
      if (!hasAnyVehicleData) return true
      return Boolean(vehicle.vehicle_identifier || vehicle.home_zone)
    })
    const sheltersValid = !state.equipment_inventory.operates_shelters || state.equipment_inventory.shelters.every((shelter) => shelter.shelter_name && shelter.address && shelter.zone)
    return allVehiclesValid && sheltersValid
  }
  if (state.currentStep === 4) {
    return Boolean(state.organization_code)
  }
  return Boolean(
    state.authorization.authorized_signatory_name
    && (state.authorization.password || '').length >= 8
    && state.authorization.agree_data_sharing
    && state.authorization.agree_operational_guidelines
  )
}

const organizationStepTitle = (step) => ({
  1: 'Organization Registration — Identity',
  2: 'Organization Registration — Jurisdiction and Coverage',
  3: 'Organization Registration — Equipment Inventory',
  4: 'Organization Registration — Responder Roster',
  5: 'Organization Registration — Authorization and Verification',
}[step])

const organizationStepSubtitle = (step) => ({
  1: 'Register the organization that owns responders, vehicles, and shelter resources.',
  2: 'Coverage zones define where the organization can be considered in the response network.',
  3: 'Vehicles, supplies, shelters, and communication assets become live resources after verification.',
  4: 'Organization codes link responder accounts and invitation emails.',
  5: 'Verification keeps resources inactive until approved by an administrator.',
}[step])

export default OrganizationRegistrationFlow

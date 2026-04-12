import React, { useState } from 'react'
import RoleSelectionScreen from './RoleSelectionScreen'
import VictimRegistrationFlow from './VictimRegistrationFlow'
import OrganizationRegistrationFlow from './OrganizationRegistrationFlow'
import ResponderRegistrationFlow from './ResponderRegistrationFlow'

const RegistrationHub = () => {
  const [selectedRole, setSelectedRole] = useState('')

  if (selectedRole === 'victim') {
    return <VictimRegistrationFlow onBackToRoles={() => setSelectedRole('')} />
  }

  if (selectedRole === 'organization') {
    return <OrganizationRegistrationFlow onBackToRoles={() => setSelectedRole('')} />
  }

  if (selectedRole === 'responder') {
    return <ResponderRegistrationFlow onBackToRoles={() => setSelectedRole('')} />
  }

  return <RoleSelectionScreen onSelectRole={setSelectedRole} />
}

export default RegistrationHub

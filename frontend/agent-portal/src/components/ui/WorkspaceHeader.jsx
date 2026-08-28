import Icon from './Icon.jsx'
import { getConfiguredAgent } from '../../config/runtime.js'

const PAGE_NAMES = {
  '/agent': 'Overview',
  '/agent/register': 'Register customer',
  '/agent/topup': 'Add money',
  '/agent/manage': 'Manage card',
  '/merchant': 'Payment terminal',
  '/merchant/pay': 'Payment terminal',
  '/merchant/setup': 'Choose merchant',
}

export default function WorkspaceHeader({ pathname, role, merchant }) {
  const isAgent = role === 'agent'
  const pageName = PAGE_NAMES[pathname] || (isAgent ? 'Agent Centre' : 'Merchant Counter')
  const identity = isAgent ? getConfiguredAgent() : merchant
  const parentName = isAgent ? 'Agent Centre' : 'Merchant Counter'

  return (
    <header className="workspace-header">
      <div className="workspace-breadcrumb" aria-label="Breadcrumb">
        <span>{parentName}</span><span aria-hidden="true">/</span><strong>{pageName}</strong>
      </div>
      <div className="workspace-identity" aria-label={`${isAgent ? 'Agent' : 'Merchant'} identity`}>
        <span className="workspace-identity-icon"><Icon name={isAgent ? 'userPlus' : 'wallet'} size={19} /></span>
        <span><small>{isAgent ? identity.name : identity.name}</small><strong>{identity.id}</strong></span>
      </div>
    </header>
  )
}

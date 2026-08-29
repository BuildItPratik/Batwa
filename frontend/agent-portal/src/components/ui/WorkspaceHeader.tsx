import { Link } from 'react-router-dom'
import Icon from './Icon'
import { useLanguage } from '../../i18n/LanguageContext'
import { getConfiguredAgent } from '../../config/runtime'
import type { Merchant } from '../../config/merchantDemo'
import type { WorkspaceRole } from './WorkspaceShell'

const PAGE_NAME_KEYS: Record<string, 'overview' | 'register' | 'topup' | 'manage' | 'merchant' | 'merchantSetup' | 'admin'> = {
  '/agent': 'overview',
  '/agent/register': 'register',
  '/agent/topup': 'topup',
  '/agent/manage': 'manage',
  '/merchant': 'merchant',
  '/merchant/pay': 'merchant',
  '/merchant/setup': 'merchantSetup',
  '/admin': 'admin',
}

const ROLE_ICONS: Record<WorkspaceRole, string> = { agent: 'userPlus', merchant: 'wallet', admin: 'receipt' }

export interface WorkspaceHeaderProps {
  pathname: string
  role: WorkspaceRole
  merchant: Merchant
}

export default function WorkspaceHeader({ pathname, role, merchant }: WorkspaceHeaderProps) {
  const { copy } = useLanguage()
  const pageKey = PAGE_NAME_KEYS[pathname]
  const pageName = (pageKey && copy.navigation[pageKey]) || copy.workspace[role]
  const identity = role === 'agent'
    ? getConfiguredAgent()
    : role === 'merchant'
      ? merchant
      : { name: copy.admin.identity, id: 'BATWA-HQ' }
  const parentName = copy.workspace[role]

  return (
    <header className="workspace-header">
      <div className="workspace-breadcrumb" aria-label={copy.common.breadcrumb}>
        <span>{parentName}</span><span aria-hidden="true">/</span><strong>{pageName}</strong>
      </div>
      <div className="workspace-header-actions">
        <div className="workspace-identity" aria-label={`${copy.workspace[role]} identity`}>
          <span className="workspace-identity-icon"><Icon name={ROLE_ICONS[role] || 'userPlus'} size={19} /></span>
          <span><small>{identity.name}</small><strong>{identity.id}</strong></span>
        </div>
        {role !== 'admin' && <Link className="workspace-dashboard-link" to="/admin"><Icon name="receipt" size={18} /><span>{copy.navigation.admin}</span></Link>}
      </div>
    </header>
  )
}

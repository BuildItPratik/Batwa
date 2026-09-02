import { NavLink, Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../../i18n/LanguageContext'
import BatwaBrand from './BatwaBrand'
import Icon from './Icon'
import LanguageMenu from './LanguageMenu'
import type { LanguageCode } from '../../i18n/copy'
import type { WorkspaceRole } from './WorkspaceShell'

interface NavItem {
  to: string
  labelKey: 'overview' | 'register' | 'topup' | 'manage' | 'merchant' | 'admin' | 'analytics'
  icon: string
  end?: boolean
}

const NAV_ITEMS: Record<WorkspaceRole, NavItem[]> = {
  agent: [
    { to: '/agent', labelKey: 'overview', icon: 'home', end: true },
    { to: '/agent/register', labelKey: 'register', icon: 'userPlus' },
    { to: '/agent/topup', labelKey: 'topup', icon: 'cash' },
    { to: '/agent/manage', labelKey: 'manage', icon: 'shield' },
  ],
  merchant: [
    { to: '/merchant/pay', labelKey: 'merchant', icon: 'card', end: true },
  ],
  admin: [
    { to: '/admin', labelKey: 'admin', icon: 'receipt', end: true },
    { to: '/admin/analytics', labelKey: 'analytics', icon: 'chart' },
  ],
}

export interface WorkspaceSidebarProps {
  role: WorkspaceRole
  language: LanguageCode
  onLanguageChange: (code: LanguageCode) => void
  demoMode: boolean
  onSwitchMerchant: () => void
}

export default function WorkspaceSidebar({ role, language, onLanguageChange, demoMode, onSwitchMerchant }: WorkspaceSidebarProps) {
  const { copy } = useLanguage()
  const isMerchant = role === 'merchant'
  const items = NAV_ITEMS[role] || NAV_ITEMS.agent
  const location = useLocation()

  const isAdmin = role === 'admin'
  return (
    <aside className="workspace-sidebar" aria-label={`${copy.workspace[role]} navigation`}>
      <div className="workspace-sidebar-brand">
        <Link to="/" aria-label={copy.workspace.backHome}><BatwaBrand compact /></Link>
        <p>{copy.workspace[role]}</p>
      </div>
      <nav className="workspace-nav">
        {items.map((item) => {
          // Prefix-match keeps section landing pages highlighted on child
          // routes (e.g. /admin/cards on "Admin dashboard"). When several
          // items prefix the path, the longest match wins so /admin/analytics
          // highlights "Analytics", not "Admin dashboard".
          const longerSibling = items.some((other) =>
            other !== item && location.pathname.startsWith(other.to) && other.to.length > item.to.length)
          const prefixActive = (isMerchant && location.pathname.startsWith('/merchant')) ||
            (isAdmin && location.pathname.startsWith(item.to) && !longerSibling)
          return (
            <NavLink className={({ isActive }) => `workspace-nav-link${(isActive || prefixActive) ? ' is-active' : ''}`} end={item.end} key={item.to} to={item.to}>
              <Icon name={item.icon} size={22} />
              <span>{copy.navigation[item.labelKey]}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className="workspace-sidebar-footer">
        {isMerchant && demoMode && <button className="workspace-footer-link" type="button" onClick={onSwitchMerchant}><Icon name="wallet" size={19} /><span>{copy.workspace.switchMerchant}</span></button>}
        <Link className="workspace-footer-link" to="/"><Icon name="arrowLeft" size={20} /><span>{copy.workspace.backHome}</span></Link>
        <LanguageMenu value={language} onChange={onLanguageChange} ariaLabel={copy.common.chooseLanguage} />
      </div>
    </aside>
  )
}

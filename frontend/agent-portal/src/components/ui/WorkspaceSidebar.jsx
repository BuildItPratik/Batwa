import { NavLink, Link, useLocation } from 'react-router-dom'
import BatwaBrand from './BatwaBrand.jsx'
import Icon from './Icon.jsx'
import LanguageMenu from './LanguageMenu.jsx'

const AGENT_ITEMS = [
  { to: '/agent', label: 'Overview', icon: 'home', end: true },
  { to: '/agent/register', label: 'Register customer', icon: 'userPlus' },
  { to: '/agent/topup', label: 'Add money', icon: 'cash' },
  { to: '/agent/manage', label: 'Manage card', icon: 'shield' },
]

const MERCHANT_ITEMS = [
  { to: '/merchant/pay', label: 'Payment terminal', icon: 'card', end: true },
]

export default function WorkspaceSidebar({ role, language, onLanguageChange, demoMode, onSwitchMerchant }) {
  const isAgent = role === 'agent'
  const items = isAgent ? AGENT_ITEMS : MERCHANT_ITEMS
  const location = useLocation()

  return (
    <aside className="workspace-sidebar" aria-label={`${isAgent ? 'Agent' : 'Merchant'} navigation`}>
      <div className="workspace-sidebar-brand">
        <Link to="/" aria-label="Back to Batwa home"><BatwaBrand compact /></Link>
        <p>{isAgent ? 'Agent Centre' : 'Merchant Counter'}</p>
      </div>
      <nav className="workspace-nav">
        {items.map((item) => (
          <NavLink className={({ isActive }) => `workspace-nav-link${(isActive || (!isAgent && location.pathname.startsWith('/merchant'))) ? ' is-active' : ''}`} end={item.end} key={item.to} to={item.to}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="workspace-sidebar-footer">
        {!isAgent && demoMode && <button className="workspace-footer-link" type="button" onClick={onSwitchMerchant}><Icon name="wallet" size={19} /><span>Switch demo merchant</span></button>}
        <Link className="workspace-footer-link" to="/"><Icon name="arrowLeft" size={20} /><span>Back to Batwa</span></Link>
        <LanguageMenu value={language} onChange={onLanguageChange} />
      </div>
    </aside>
  )
}

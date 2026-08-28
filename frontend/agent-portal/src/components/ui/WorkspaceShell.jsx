import { useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { DEMO_MODE, getConfiguredAgent, getConfiguredMerchant } from '../../config/runtime.js'
import WorkspaceSidebar from './WorkspaceSidebar.jsx'
import WorkspaceHeader from './WorkspaceHeader.jsx'
import BatwaBrand from './BatwaBrand.jsx'
import Icon from './Icon.jsx'

export default function WorkspaceShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { language, setLanguage } = useLanguage()
  const isMerchant = location.pathname.startsWith('/merchant')
  const role = isMerchant ? 'merchant' : 'agent'
  const merchant = getConfiguredMerchant()
  const agent = getConfiguredAgent()

  return (
    <div className={`workspace-shell ${isMerchant ? 'workspace-shell-merchant' : 'workspace-shell-agent'}`}>
      <WorkspaceSidebar role={role} language={language} onLanguageChange={setLanguage} demoMode={DEMO_MODE} onSwitchMerchant={() => navigate('/merchant/setup')} />
      <div className="workspace-content">
        <header className="workspace-mobilebar">
          <a href="/" aria-label="Back to Batwa home"><BatwaBrand compact /></a>
          <div className="workspace-mobile-context"><span>{isMerchant ? 'Merchant Counter' : 'Agent Centre'}</span><strong>{isMerchant ? merchant.id : agent.id}</strong></div>
          <button className="workspace-mobile-back" type="button" onClick={() => navigate('/')} aria-label="Back to Batwa home"><Icon name="arrowLeft" size={20} /></button>
        </header>
        <WorkspaceHeader pathname={location.pathname} role={role} merchant={merchant} />
        <main className="workspace-main">{children}</main>
      </div>
    </div>
  )
}

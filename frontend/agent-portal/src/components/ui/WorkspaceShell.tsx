import { useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n/LanguageContext'
import { DEMO_MODE, getConfiguredAgent, getConfiguredMerchant } from '../../config/runtime'
import WorkspaceSidebar from './WorkspaceSidebar'
import WorkspaceHeader from './WorkspaceHeader'
import BatwaBrand from './BatwaBrand'
import Icon from './Icon'
import LanguageMenu from './LanguageMenu'
import type { ReactNode } from 'react'
import { joinAppPath } from '../../config/appBase'

export type WorkspaceRole = 'agent' | 'merchant' | 'admin'

function getRole(pathname: string): WorkspaceRole {
  if (pathname.startsWith('/merchant')) return 'merchant'
  if (pathname.startsWith('/admin')) return 'admin'
  return 'agent'
}

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { language, setLanguage, copy, isTranslating, translationError } = useLanguage()
  const role = getRole(location.pathname)
  const merchant = getConfiguredMerchant()
  const agent = getConfiguredAgent()
  const mobileContextId = role === 'merchant' ? merchant.id : role === 'agent' ? agent.id : 'BATWA-HQ'

  return (
    <div className={`workspace-shell workspace-shell-${role}`}>
      <WorkspaceSidebar role={role} language={language} onLanguageChange={setLanguage} loading={isTranslating} translationError={translationError} demoMode={DEMO_MODE} onSwitchMerchant={() => navigate('/merchant/setup')} />
      <div className="workspace-content">
        <header className="workspace-mobilebar">
          <a href={joinAppPath('/')} aria-label={copy.workspace.backHome}><BatwaBrand compact /></a>
          <div className="workspace-mobile-context"><span>{copy.workspace[role]}</span><strong>{mobileContextId}</strong></div>
          <div className="workspace-mobile-tools">
            <LanguageMenu value={language} onChange={setLanguage} loading={isTranslating} loadingLabel={copy.common.translating} ariaLabel={copy.common.chooseLanguage} />
            <button className="workspace-mobile-back" type="button" onClick={() => navigate('/')} aria-label={copy.workspace.backHome}><Icon name="arrowLeft" size={20} /></button>
          </div>
        </header>
          <WorkspaceHeader pathname={location.pathname} role={role} merchant={merchant} />
        <main className="workspace-main">{children}</main>
      </div>
    </div>
  )
}

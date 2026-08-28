import { Route, Routes } from 'react-router-dom'
import RegisterCustomer from './pages/RegisterCustomer.jsx'
import TopUp from './pages/TopUp.jsx'
import BlockReissue from './pages/BlockReissue.jsx'
import AgentHome from './pages/AgentHome.jsx'
import LandingPage from './pages/LandingPage.jsx'
import MerchantPortal from './pages/MerchantPortal.jsx'
import MerchantSetup from './pages/MerchantSetup.jsx'
import AppShell from './components/ui/AppShell.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { DEMO_MODE, getConfiguredMerchant } from './config/runtime.js'

function ShellPage({ children }) {
  return <AppShell>{children}</AppShell>
}

function MerchantEntry() {
  const merchant = getConfiguredMerchant()
  return <MerchantPortal merchantId={merchant.id} merchantName={merchant.name} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/agent" element={<ShellPage><AgentHome /></ShellPage>} />
      <Route path="/agent/register" element={<ShellPage><RegisterCustomer /></ShellPage>} />
      <Route path="/agent/topup" element={<ShellPage><TopUp /></ShellPage>} />
      <Route path="/agent/manage" element={<ShellPage><BlockReissue /></ShellPage>} />
      <Route path="/merchant/setup" element={<ShellPage><MerchantSetup /></ShellPage>} />
      <Route path="/merchant" element={<ShellPage>{DEMO_MODE ? <MerchantSetup /> : <MerchantEntry />}</ShellPage>} />
      <Route path="/merchant/pay" element={<ShellPage><MerchantEntry /></ShellPage>} />
      <Route path="*" element={<ShellPage><LandingPage /></ShellPage>} />
    </Routes>
  )
}

export default function App() {
  return <LanguageProvider><AppRoutes /></LanguageProvider>
}

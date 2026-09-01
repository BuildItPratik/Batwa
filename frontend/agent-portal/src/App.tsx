import { Route, Routes } from 'react-router-dom'
import RegisterCustomer from './pages/RegisterCustomer'
import TopUp from './pages/TopUp'
import BlockReissue from './pages/BlockReissue'
import AgentHome from './pages/AgentHome'
import LandingPage from './pages/LandingPage'
import MerchantPortal from './pages/MerchantPortal'
import MerchantSetup from './pages/MerchantSetup'
import AdminDashboard from './pages/AdminDashboard'
import AppShell from './components/ui/AppShell'
import { LanguageProvider } from './i18n/LanguageContext'
import { DEMO_MODE, getConfiguredMerchant } from './config/runtime'
import type { ReactNode } from 'react'
import CustomerWallet from './pages/CustomerWallet'

function ShellPage({ children }: { children: ReactNode }) {
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
      <Route path="/admin" element={<ShellPage><AdminDashboard /></ShellPage>} />
      <Route path="*" element={<ShellPage><LandingPage /></ShellPage>} />
      <Route path="/customer/wallet" element={<ShellPage><CustomerWallet /></ShellPage>} />
    </Routes>
  )
}

export default function App() {
  return <LanguageProvider><AppRoutes /></LanguageProvider>
}

import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import RegisterCustomer from './pages/RegisterCustomer.jsx'
import TopUp from './pages/TopUp.jsx'
import BlockReissue from './pages/BlockReissue.jsx'

// NOTE for integration (Day 4): per the blueprint this is meant to end up
// living inside ONE shared React app with routes for /agent, /merchant,
// /customer, /admin. For now this file only owns /agent/* so Pratik can
// build and test independently. When merging with Krishna/Ruchir's routers,
// these <Routes> should be nested under the shared app's <Route path="/agent">.

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>TapWallet · Agent</h1>
      </header>

      <nav className="app-nav">
        <NavLink
          to="/agent/register"
          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
        >
          Register
        </NavLink>
        <NavLink
          to="/agent/topup"
          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
        >
          Top-Up
        </NavLink>
        <NavLink
          to="/agent/manage"
          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
        >
          Block/Reissue
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/agent/register" replace />} />
        <Route path="/agent" element={<Navigate to="/agent/register" replace />} />
        <Route path="/agent/register" element={<RegisterCustomer />} />
        <Route path="/agent/topup" element={<TopUp />} />
        <Route path="/agent/manage" element={<BlockReissue />} />
      </Routes>
    </div>
  )
}

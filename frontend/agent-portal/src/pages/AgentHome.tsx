import { Link } from 'react-router-dom'
import { PortalFrame } from '../components/ui/index'
import Icon from '../components/ui/Icon'
import { getConfiguredAgent } from '../config/runtime'

const TASKS = [
  { to: '/agent/register', number: '01', title: 'Register customer', text: 'Create and print a new Batwa card.', icon: 'userPlus', primary: true },
  { to: '/agent/topup', number: '02', title: 'Add money', text: 'Convert received cash into wallet balance.', icon: 'cash' },
  { to: '/agent/manage', number: '03', title: 'Manage card', text: 'Block a lost card or safely reissue it.', icon: 'shield' },
]

export default function AgentHome() {
  const agent = getConfiguredAgent()
  return (
    <PortalFrame
      eyebrow="Agent Centre"
      title="Your counter is ready."
      description="Choose a task to help the next customer."
      className="agent-overview-panel"
    >
      <div className="agent-overview-topline">
        <div className="agent-float-receipt">
          <div className="receipt-heading"><Icon name="wallet" size={25} /><span>Available agent float</span></div>
          <strong className="receipt-unavailable">Balance shown after a top-up</strong>
          <p><Icon name="check" size={16} /> Confirmed on every receipt</p>
        </div>
      </div>
      <div className="agent-task-grid">
        {TASKS.map((task) => (
          <Link className={`agent-task-card${task.primary ? ' is-primary' : ''}`} key={task.to} to={task.to}>
            <span className="agent-task-icon"><Icon name={task.icon} size={34} /></span>
            <span className="agent-task-copy">
            <span className="task-card-number">{task.number}</span>
            <span className="task-card-title">{task.title}</span>
            <span className="task-card-text">{task.text}</span>
            </span>
            <span className="task-card-arrow" aria-hidden="true"><Icon name="arrowRight" size={25} /></span>
          </Link>
        ))}
      </div>
      <div className="counter-guide"><span className="counter-guide-title"><Icon name="receipt" size={24} /> Counter guide</span><span><Icon name="cash" size={20} /> Cash received</span><Icon name="arrowRight" size={20} /><span><Icon name="wallet" size={20} /> Wallet credited</span><Icon name="arrowRight" size={20} /><span><Icon name="receipt" size={20} /> Receipt confirmed</span><p>Card numbers can always be entered manually.</p></div>
      <p className="agent-overview-note">Signed in as <strong>{agent.name}</strong> · {agent.id}</p>
      <div className="overview-counter-floor" aria-label="Counter rhythm">
        <div className="overview-floor-heading"><Icon name="wallet" size={23} /><div><strong>Ready for the next customer</strong><span>Keep the counter rhythm simple and visible.</span></div></div>
        <div className="overview-floor-list"><span><Icon name="cash" size={19} /> Receive cash</span><span><Icon name="card" size={19} /> Identify the card</span><span><Icon name="shield" size={19} /> Confirm securely</span></div>
      </div>
    </PortalFrame>
  )
}

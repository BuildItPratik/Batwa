import { Link } from 'react-router-dom'
import { PortalFrame } from '../components/ui/index'
import Icon from '../components/ui/Icon'
import { getConfiguredAgent } from '../config/runtime'
import { useLanguage } from '../i18n/LanguageContext'

export default function AgentHome() {
  const agent = getConfiguredAgent()
  const { copy } = useLanguage()
  const tasks = [
    { to: '/agent/register', number: '01', title: copy.agentOverview.tasks.registerTitle, text: copy.agentOverview.tasks.registerText, icon: 'userPlus', primary: true },
    { to: '/agent/topup', number: '02', title: copy.agentOverview.tasks.topupTitle, text: copy.agentOverview.tasks.topupText, icon: 'cash' },
    { to: '/agent/manage', number: '03', title: copy.agentOverview.tasks.manageTitle, text: copy.agentOverview.tasks.manageText, icon: 'shield' },
  ]
  return (
    <PortalFrame
      eyebrow={copy.agentOverview.eyebrow}
      title={copy.agentOverview.title}
      description={copy.agentOverview.description}
      className="agent-overview-panel"
    >
      <div className="agent-overview-topline">
        <div className="agent-float-receipt">
             <div className="receipt-heading"><Icon name="wallet" size={25} /><span>{copy.agentOverview.availableFloat}</span></div>
             <strong className="receipt-unavailable">{copy.agentOverview.balanceAfterTopup}</strong>
             <p><Icon name="check" size={16} /> {copy.agentOverview.confirmedOnReceipt}</p>
        </div>
      </div>
      <div className="agent-task-grid">
         {tasks.map((task) => (
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
       <div className="counter-guide"><span className="counter-guide-title"><Icon name="receipt" size={24} /> {copy.agentOverview.counterGuide}</span><span><Icon name="cash" size={20} /> {copy.agentOverview.cashReceived}</span><Icon name="arrowRight" size={20} /><span><Icon name="wallet" size={20} /> {copy.agentOverview.walletCredited}</span><Icon name="arrowRight" size={20} /><span><Icon name="receipt" size={20} /> {copy.agentOverview.receiptConfirmed}</span><p>{copy.agentOverview.manualCardNote}</p></div>
       <p className="agent-overview-note">{copy.agentOverview.signedInAs} <strong>{agent.name}</strong> · {agent.id}</p>
       <div className="overview-counter-floor" aria-label={copy.agentOverview.readyTitle}>
         <div className="overview-floor-heading"><Icon name="wallet" size={23} /><div><strong>{copy.agentOverview.readyTitle}</strong><span>{copy.agentOverview.readyText}</span></div></div>
         <div className="overview-floor-list"><span><Icon name="cash" size={19} /> {copy.agentOverview.receiveCash}</span><span><Icon name="card" size={19} /> {copy.agentOverview.identifyCard}</span><span><Icon name="shield" size={19} /> {copy.agentOverview.confirmSecurely}</span></div>
      </div>
    </PortalFrame>
  )
}

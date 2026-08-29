export interface ProgressStep {
  id: string
  label: string
}

export interface ProgressStepsProps {
  steps: ProgressStep[]
  currentStep: string
  ariaLabel?: string
}

export default function ProgressSteps({ steps, currentStep, ariaLabel = 'Payment progress' }: ProgressStepsProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStep),
  )

  return (
    <ol className="batwa-progress" aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const complete = index < currentIndex
        const active = index === currentIndex
        return (
          <li
            className={
              'batwa-progress-step' +
              (complete ? ' is-complete' : '') +
              (active ? ' is-active' : '')
            }
            key={step.id}
            aria-current={active ? 'step' : undefined}
          >
            <span className="batwa-progress-marker" aria-hidden="true">
              {complete ? '✓' : index + 1}
            </span>
            <span>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

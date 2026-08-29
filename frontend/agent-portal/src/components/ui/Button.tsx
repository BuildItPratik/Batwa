import { forwardRef, type ButtonHTMLAttributes } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet'
  size?: 'regular' | 'large'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'regular', className = '', type = 'button', ...props },
  ref,
) {
  const classes = [
    'batwa-button',
    'batwa-button-' + variant,
    'batwa-button-' + size,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <button ref={ref} type={type} className={classes} {...props} />
})

export default Button

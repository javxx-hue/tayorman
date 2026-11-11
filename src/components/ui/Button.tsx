import React from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  disabled,
  ...props
}) => {
  // Raised buttons: a darker edge underneath that the button sinks into when pressed
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none active:translate-y-[2px] select-none';

  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:brightness-110 shadow-[0_4px_0_0_hsl(var(--primary-shade))] active:shadow-[0_2px_0_0_hsl(var(--primary-shade))]',
    secondary: 'bg-secondary text-secondary-foreground hover:brightness-110 shadow-[0_3px_0_0_hsl(var(--border))] active:shadow-[0_1px_0_0_hsl(var(--border))]',
    outline: 'border border-border bg-card hover:bg-secondary/60 text-foreground shadow-[0_3px_0_0_hsl(var(--border))] active:shadow-[0_1px_0_0_hsl(var(--border))]',
    ghost: 'hover:bg-secondary/60 text-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  };

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5 font-semibold',
  };

  return (
    <button
      className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

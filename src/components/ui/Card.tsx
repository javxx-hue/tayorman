import React from 'react';
import clsx from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'interactive' | 'outline';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className,
  ...props
}) => {
  const base = 'rounded-2xl transition-all duration-200 border';
  
  const variants = {
    default: 'bg-card text-card-foreground border-border/80 shadow-soft',
    muted: 'bg-muted/50 text-foreground border-border/50',
    interactive: 'bg-card text-card-foreground border-border hover:border-primary/40 hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer',
    outline: 'bg-transparent border-border',
  };

  return (
    <div className={clsx(base, variants[variant], className)} {...props}>
      {children}
    </div>
  );
};

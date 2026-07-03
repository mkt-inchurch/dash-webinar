import { FC, ReactNode } from 'react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

interface KPICardProps {
  title: string;
  value: string | number;
  valueSuffix?: ReactNode;
  subtitle?: string;
  footer?: ReactNode;
  icon?: ReactNode;
  highlight?: boolean;
  active?: boolean;
  onClick?: () => void;
  delay?: number;
}

export const KPICard: FC<KPICardProps> = ({ title, value, valueSuffix, subtitle, footer, icon, highlight, active, onClick, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between h-full min-h-[136px] transition-all",
        onClick && "cursor-pointer",
        active
          ? "border-in-green ring-2 ring-in-green/50 bg-bg-card-hover"
          : highlight
            ? "border-in-green bg-in-green-dim"
            : "border-bg-card-border bg-bg-card hover:bg-bg-card-hover"
      )}
    >
      {(highlight || active) && (
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-in-green rounded-full opacity-20 blur-3xl pointer-events-none" />
      )}
      
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-fg-muted">{title}</h3>
        {icon && (
          <div className={cn("p-1.5 rounded-lg", highlight ? "bg-in-green text-black" : "bg-bg-card-border text-in-green")}>
            {icon}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className={cn("text-2xl font-bold tracking-tight", highlight ? "text-in-green" : "text-fg")}>
            {value}
          </span>
          {valueSuffix}
        </div>
        {subtitle && (
          <p className="text-xs font-mono text-fg-subtle uppercase tracking-widest">{subtitle}</p>
        )}
        {footer && (
          <div className="mt-2">{footer}</div>
        )}
      </div>
    </motion.div>
  );
};

import React from 'react';

interface GuidanceTooltipProps {
  guideKey?: string;
  children: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showIndicator?: boolean;
}

/**
 * Production GuidanceTooltip: Pure pass-through.
 * Purged of all floating tutorial/guidance dots and demo popovers.
 */
export const GuidanceTooltip: React.FC<GuidanceTooltipProps> = ({ children, className = '' }) => {
  return <div className={`inline-flex ${className}`}>{children}</div>;
};

import React from 'react';
import * as Lucide from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

interface ResearchIconProps {
  name: keyof typeof Lucide;
  size?: number;
  className?: string;
  ariaLabel?: string;
  flipInRtl?: boolean;
}

export const ResearchIcon: React.FC<ResearchIconProps> = ({
  name,
  size = 18,
  className = '',
  ariaLabel,
  flipInRtl = false
}) => {
  const { language } = useProject();
  const IconComponent = Lucide[name] as React.ComponentType<any>;

  if (!IconComponent) {
    console.warn(`Icon ${name} does not exist in lucide-react`);
    return null;
  }

  const isRtl = language === 'ar';
  const shouldFlip = flipInRtl && isRtl;

  const combinedClassName = `shrink-0 ${shouldFlip ? 'scale-x-[-1]' : ''} ${className}`;

  return (
    <IconComponent
      size={size}
      className={combinedClassName}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
    />
  );
};

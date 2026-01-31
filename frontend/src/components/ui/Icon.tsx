'use client';

import { ComponentType, SVGProps } from 'react';
import clsx from 'clsx';

type IconSize = 'xs' | 'sm' | 'md' | 'lg';

interface IconProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  size?: IconSize;
  className?: string;
}

const sizeMap: Record<IconSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function Icon({ icon: IconComponent, size = 'sm', className }: IconProps) {
  return (
    <IconComponent 
      className={clsx(sizeMap[size], 'flex-shrink-0', className)} 
      aria-hidden="true"
    />
  );
}

export default Icon;

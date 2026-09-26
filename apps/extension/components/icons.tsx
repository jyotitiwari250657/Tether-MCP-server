// AC-F14-01/06 (Prompt 14-FIX-01): Inline SVG stroke icons for popup/sidepanel.
// The brand mark/lockup is raster-derived (scripts/compose-brand-assets.mjs) and
// rendered via <img>; no synthesized monogram may live here. Labels unchanged.
import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function Icon({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function IconPower(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3v8" />
      <path d="M6.3 6.5a8 8 0 1 0 11.4 0" />
    </Icon>
  );
}

export function IconRotate(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20 11a8 8 0 1 0-2.3 6.3" />
      <path d="M20 4v7h-7" />
    </Icon>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z" />
      <path d="M9 11.5l2 2 4-4.5" />
    </Icon>
  );
}

export function IconLink(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
    </Icon>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.6a3.5 3.5 0 0 1 0 5.7" />
      <path d="M17.5 13.6a5.5 5.5 0 0 1 3 5.4" />
    </Icon>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

import type { ReactNode } from 'react';

type IconProps = { width?: number | string; height?: number | string; className?: string };

function Svg({
  children,
  width = 24,
  height = 24,
  className,
}: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
      <Svg {...props}>
      <path
        d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    </Svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
      <Svg {...props}>
      <path
        d="M7.2 3.8h2.4l1.2 3-1.6 1.2a12.4 12.4 0 0 0 5.6 5.6l1.2-1.6 3 1.2v2.4c0 .9-.7 1.7-1.6 1.8-7.4.6-13.6-5.6-13-13 .1-.9.9-1.6 1.8-1.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
      <Svg {...props}>
      <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m4.2 6.8 7.8 6.2 7.8-6.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </Svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
      <Svg {...props}>
      <path
        d="M14.2 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4H17V5.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v1.8H8.4v2.8h2.5V21h3.3Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
      <Svg {...props}>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.6V12l3 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function VisitIcon(props: IconProps) {
  return (
      <Svg {...props}>
      <path
        d="M8.2 6.2c1.1.2 1.8 1.6 1.5 3.1-.3 1.4-1.4 2.4-2.4 2.2-1.1-.2-1.8-1.6-1.5-3.1.3-1.4 1.4-2.4 2.4-2.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M7.4 13.2c.9.4 1.2 1.7.6 2.9-.6 1.2-1.8 1.8-2.6 1.4-.9-.4-1.2-1.7-.6-2.9.6-1.2 1.8-1.8 2.6-1.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M16.6 5.4c1.1-.1 2.1 1.1 2.2 2.7.1 1.5-.8 2.8-1.9 2.9-1.1.1-2.1-1.1-2.2-2.7-.1-1.5.8-2.8 1.9-2.9Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M16.2 12.6c.9.2 1.4 1.4 1.1 2.7-.4 1.3-1.4 2.1-2.3 1.9-.9-.2-1.4-1.4-1.1-2.7.4-1.3 1.4-2.1 2.3-1.9Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </Svg>
  );
}

export function ApplyIcon(props: IconProps) {
  return (
      <Svg {...props}>
      <path
        d="M7.2 4.4h7.2L18.8 9v10.6H7.2V4.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14.4 4.6V9h4.2M9.4 13h6.2M9.4 16.2h4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function AssessIcon(props: IconProps) {
  return (
      <Svg {...props}>
      <path d="M5.4 6.2h13.2v12.6H5.4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path
        d="m8.2 12.2 2.2 2.2 5.2-5.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function WelcomeIcon(props: IconProps) {
  return (
      <Svg {...props}>
      <path
        d="M7.6 14.2c0-2.2 1.8-4 4.4-4s4.4 1.8 4.4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="8.4" cy="9.2" r="1.7" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="15.6" cy="9.2" r="1.7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.8 18.6c1.4-1.8 3.3-2.7 5.2-2.7M19.2 18.6c-1.4-1.8-3.3-2.7-5.2-2.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

import type { ReactNode } from 'react';

interface GlyphProps {
  className?: string;
  title?: string;
}

function GlyphBase({ className, title, children }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : 'presentation'}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function StarburstGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M12 2.5l1.2 3.6 3.6-1.2-1.2 3.6 3.6 1.2-3.6 1.2 1.2 3.6-3.6-1.2L12 21.5l-1.2-3.6-3.6 1.2 1.2-3.6-3.6-1.2 3.6-1.2-1.2-3.6 3.6 1.2L12 2.5z" />
    </GlyphBase>
  );
}

export function ArrowScribbleGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M4 12h12" />
      <path d="M13.5 6.5l5 5-5 5" />
      <path d="M9 8.5h3" />
    </GlyphBase>
  );
}

export function CheckGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M6 12.5l3.5 3.5L18 7.5" />
      <path d="M4.5 6.5C3 8 2.4 10.3 3 12.6c.6 2.3 2.3 4.2 4.7 5.1 2.4.9 5 .6 7.1-.9" />
    </GlyphBase>
  );
}

export function ShieldWaveGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" />
      <path d="M7.5 12.2c1.3-1 2.8-1 4.2 0 1.5 1 3 1 4.8 0" />
    </GlyphBase>
  );
}

export function CompassGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <circle cx="12" cy="12" r="8" />
      <path d="M10 10l7-2-2 7-7 2 2-7z" />
      <path d="M12 6.5v2" />
    </GlyphBase>
  );
}

export function BridgeGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M3 15h18" />
      <path d="M5 15c2-5 12-5 14 0" />
      <path d="M7 15V9" />
      <path d="M17 15V9" />
      <path d="M12 9V7" />
    </GlyphBase>
  );
}

export function ThreadGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M6 7c1.5-2 4-2.5 6.5-1.5 2.6 1 4.2 3.5 3.8 6.3" />
      <path d="M6 17c2 1.2 4.8 1 6.8-.7 2-1.6 2.7-4.2 1.8-6.6" />
      <circle cx="5" cy="7" r="1.5" />
      <circle cx="19" cy="16" r="1.5" />
    </GlyphBase>
  );
}

export function NotebookGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <rect x="5" y="4" width="12" height="16" rx="2" />
      <path d="M9 8h5" />
      <path d="M9 12h5" />
      <path d="M9 16h3" />
    </GlyphBase>
  );
}

export function PulseGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M3 12h4l2-4 3 8 2-4h7" />
    </GlyphBase>
  );
}

export function MapGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M4 7l5-2 6 2 5-2v12l-5 2-6-2-5 2V7z" />
      <path d="M9 5v12" />
      <path d="M15 7v12" />
    </GlyphBase>
  );
}

export function BadgeGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <circle cx="12" cy="9" r="4" />
      <path d="M9 13l-1 7 4-2 4 2-1-7" />
    </GlyphBase>
  );
}

export function TargetGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3" />
    </GlyphBase>
  );
}

export function HeartPathGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M12 19c-3.5-2.3-7-5.2-7-8.6C5 8 6.7 6.5 8.7 6.5c1.4 0 2.6.7 3.3 2 0.7-1.3 1.9-2 3.3-2 2 0 3.7 1.5 3.7 3.9 0 3.4-3.5 6.3-7 8.6z" />
      <path d="M8 12.3h2l1.2 2.2 1.2-2.2h2" />
    </GlyphBase>
  );
}

export function CaretGlyph({ className, title }: GlyphProps) {
  return (
    <GlyphBase className={className} title={title}>
      <path d="M6 9l6 6 6-6" />
    </GlyphBase>
  );
}

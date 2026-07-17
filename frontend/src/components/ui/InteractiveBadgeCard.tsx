"use client";
import React, { useRef } from 'react';

// Extend props to accept standard HTML attributes for <a> and <div>
// This allows Tooltip to pass its necessary event handlers.
interface InteractiveBadgeCardProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string; // This will be merged with Tooltip's className if Tooltip adds one
  href?: string;
  isEarned: boolean;
  ariaLabel?: string; // aria-label is a standard HTML attribute
  style?: React.CSSProperties;
}

// MAX_ROTATE and the mouse event handlers are removed as they were for the 3D tilt effect.
// If you intend to keep a different JS-based hover effect, you'd need to merge
// Tooltip's event props with your own (e.g., call both your onMouseLeave and props.onMouseLeave).
// For the aurora effect, these are not needed.

const InteractiveBadgeCard: React.FC<InteractiveBadgeCardProps> = ({
    children,
    className,
    href,
    isEarned,
    ariaLabel, // Will be handled by ...rest
    style,
    ...rest // Capture all other props passed by Tooltip (onMouseEnter, onMouseLeave, etc.)
}) => {
    // cardRef is kept in case you need it for other non-event-driven effects,
    // but it's not used by the removed mouse handlers.
    const cardRef = useRef<HTMLAnchorElement | HTMLDivElement>(null);

    // Spread Tooltip handlers (onMouseEnter/onMouseLeave, etc.) via ...rest
    const commonAttributes = {
        className: className || '', // Use the className passed from parent
        style,
        "aria-label": ariaLabel, // Explicitly pass ariaLabel, or let ...rest handle it
        ...rest, // Spread the rest of the props (including Tooltip's event handlers)
    };

    if (isEarned && href && href !== '#') {
        return (
        <a
            ref={cardRef as React.Ref<HTMLAnchorElement>}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            {...commonAttributes}
        >
            {children}
        </a>
        );
    }
    // 2) Earned without link → native <button>
    if (isEarned) {
        return (
        <button
            ref={cardRef as React.Ref<HTMLButtonElement>}
            type="button"
            {...commonAttributes}
        >
            {children}
        </button>
        );
    }

    // 3) Locked → plain <div>, no role needed
    return (
        <div ref={cardRef as React.Ref<HTMLDivElement>} {...commonAttributes}>
        {children}
        </div>
    );
    };

export default InteractiveBadgeCard;
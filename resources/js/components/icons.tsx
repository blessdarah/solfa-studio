import type { ReactNode } from 'react';

/**
 * Icons drawn exactly as in the Paper file: a 16-unit grid, round caps,
 * strokes in currentColor so the parent's text colour decides the ink.
 */
type IconProps = { size?: number; className?: string; strokeWidth?: number };

function Svg({
    size = 16,
    className,
    children,
    viewBox = '0 0 16 16',
}: {
    size?: number;
    className?: string;
    children: ReactNode;
    viewBox?: string;
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox={viewBox}
            aria-hidden="true"
            className={className}
            style={{ flexShrink: 0, display: 'inline-block' }}
        >
            {children}
        </svg>
    );
}

const line = (strokeWidth: number) =>
    ({
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
    }) as const;

export function SearchIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <circle cx="7" cy="7" r="4.5" {...line(strokeWidth)} />
            <path d="m10.5 10.5 3 3" {...line(strokeWidth)} />
        </Svg>
    );
}

export function BellIcon({ size = 16, className, strokeWidth = 1.4 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M4 11.5h8l-1.1-1.7V7a2.9 2.9 0 0 0-5.8 0v2.8L4 11.5Z" {...line(strokeWidth)} />
            <path d="M6.6 13.2a1.5 1.5 0 0 0 2.8 0" {...line(strokeWidth)} />
        </Svg>
    );
}

export function PlusIcon({ size = 13, className, strokeWidth = 1.8 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M8 3.5v9M3.5 8h9" {...line(strokeWidth)} />
        </Svg>
    );
}

export function ChevronDownIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="m5 6.5 3 3 3-3" {...line(strokeWidth)} />
        </Svg>
    );
}

export function LayersIcon({ size = 16, className, strokeWidth = 1.4 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M8 2 14 5.5 8 9 2 5.5 8 2Z" {...line(strokeWidth)} />
            <path d="m2 8.5 6 3.5 6-3.5" {...line(strokeWidth)} />
            <path d="m2 11.5 6 3.5 6-3.5" {...line(strokeWidth)} />
        </Svg>
    );
}

export function CheckCircleIcon({ size = 16, className, strokeWidth = 1.4 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <circle cx="8" cy="8" r="5.8" {...line(strokeWidth)} />
            <path d="m5.6 8 1.7 1.7 3.1-3.4" {...line(strokeWidth)} />
        </Svg>
    );
}

export function UsersIcon({ size = 16, className, strokeWidth = 1.4 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <circle cx="6" cy="6" r="2.4" {...line(strokeWidth)} />
            <path d="M2 13.4c0-2.1 1.8-3.8 4-3.8s4 1.7 4 3.8" {...line(strokeWidth)} />
            <path d="M11 4.3a2.3 2.3 0 0 1 0 4.4" {...line(strokeWidth)} />
            <path d="M12.2 10.2c1.1.6 1.8 1.7 1.8 3.2" {...line(strokeWidth)} />
        </Svg>
    );
}

export function ArchiveIcon({ size = 16, className, strokeWidth = 1.4 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <rect x="2.2" y="3" width="11.6" height="3" rx="1" {...line(strokeWidth)} />
            <path d="M3.2 6v6.4c0 .9.7 1.6 1.6 1.6h6.4c.9 0 1.6-.7 1.6-1.6V6" {...line(strokeWidth)} />
            <path d="M6.4 9h3.2" {...line(strokeWidth)} />
        </Svg>
    );
}

export function ScanIcon({ size = 15, className, strokeWidth = 1.5 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M3 6V4a1 1 0 0 1 1-1h2" {...line(strokeWidth)} />
            <path d="M13 6V4a1 1 0 0 0-1-1h-2" {...line(strokeWidth)} />
            <path d="M3 10v2a1 1 0 0 0 1 1h2" {...line(strokeWidth)} />
            <path d="M13 10v2a1 1 0 0 1-1 1h-2" {...line(strokeWidth)} />
            <path d="M2 8h12" {...line(strokeWidth)} />
        </Svg>
    );
}

export function FilterIcon({ size = 13, className, strokeWidth = 1.4 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M4 5h8M6 8h4M7.5 11h1" {...line(strokeWidth)} />
        </Svg>
    );
}

export function ArrowRightIcon({ size = 13, className, strokeWidth = 1.6 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M3 8h10" {...line(strokeWidth)} />
            <path d="m9 4 4 4-4 4" {...line(strokeWidth)} />
        </Svg>
    );
}

export function PlayIcon({ size = 14, className }: IconProps) {
    return (
        <Svg size={size} className={className} viewBox="0 0 24 24">
            <path d="M7 4l13 8-13 8z" fill="currentColor" />
        </Svg>
    );
}

export function StopIcon({ size = 14, className }: IconProps) {
    return (
        <Svg size={size} className={className} viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
        </Svg>
    );
}

export function SparkleIcon({ size = 15, className }: IconProps) {
    return (
        <Svg size={size} className={className} viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" fill="currentColor" />
        </Svg>
    );
}

export function CloseIcon({ size = 18, className, strokeWidth = 2 }: IconProps) {
    return (
        <Svg size={size} className={className} viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" {...line(strokeWidth)} />
        </Svg>
    );
}

export function PenIcon({ size = 16, className, strokeWidth = 1.5 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M10.5 3.2 12.8 5.5 6 12.3l-3 .7.7-3 6.8-6.8Z" {...line(strokeWidth)} />
            <path d="M9 13h4" {...line(strokeWidth)} />
        </Svg>
    );
}

export function LogOutIcon({ size = 14, className, strokeWidth = 1.5 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M6 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2" {...line(strokeWidth)} />
            <path d="M10 5.5 12.5 8 10 10.5M12.5 8H6.5" {...line(strokeWidth)} />
        </Svg>
    );
}

export function XIcon({ size = 12, className, strokeWidth = 1.6 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" {...line(strokeWidth)} />
        </Svg>
    );
}

export function TrashIcon({ size = 16, className, strokeWidth = 1.4 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path
                d="M2.5 4.2h11M6.3 4.2V2.9c0-.4.3-.7.7-.7h2c.4 0 .7.3.7.7v1.3M4 4.2l.6 8.6c.1.7.6 1.2 1.3 1.2h4.2c.7 0 1.2-.5 1.3-1.2l.6-8.6M6.7 7v4.4M9.3 7v4.4"
                {...line(strokeWidth)}
            />
        </Svg>
    );
}

export function PrintIcon({ size = 16, className, strokeWidth = 1.4 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path
                d="M4.5 6V2.5h7V6M4.5 11.5h-1A1.5 1.5 0 0 1 2 10V7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V10a1.5 1.5 0 0 1-1.5 1.5h-1M4.5 9.5h7v4h-7z"
                {...line(strokeWidth)}
            />
        </Svg>
    );
}

export function LoopIcon({ size = 15, className, strokeWidth = 1.4 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M3 7.5V6a2 2 0 0 1 2-2h8M11 2l2 2-2 2M13 8.5V10a2 2 0 0 1-2 2H3M5 14l-2-2 2-2" {...line(strokeWidth)} />
        </Svg>
    );
}

/** ↻ — a passage playing over and over. */
export function RepeatIcon({ size = 14, className, strokeWidth = 1.6 }: IconProps) {
    return (
        <Svg size={size} className={className}>
            <path d="M13 8.2a5 5 0 1 1-1.5-3.6" {...line(strokeWidth)} />
            <path d="M12 1.8v3.2H8.8" {...line(strokeWidth)} />
        </Svg>
    );
}

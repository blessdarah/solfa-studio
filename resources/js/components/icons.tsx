import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SvgProps = {
    children: ReactNode;
    className?: string;
};

function Svg({ children, className }: SvgProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cn('h-4 w-4', className)}
        >
            {children}
        </svg>
    );
}

export function SearchIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4.5 4.5" />
        </Svg>
    );
}

export function PlusIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M12 5v14M5 12h14" />
        </Svg>
    );
}

export function ArrowRightIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
        </Svg>
    );
}

export function ArrowLeftIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M19 12H5" />
            <path d="m11 18-6-6 6-6" />
        </Svg>
    );
}

export function ChevronDownIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="m6 9 6 6 6-6" />
        </Svg>
    );
}

export function LayersIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="m12 2 9 5-9 5-9-5 9-5Z" />
            <path d="m3 12 9 5 9-5" />
            <path d="m3 17 9 5 9-5" />
        </Svg>
    );
}

export function AlertIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </Svg>
    );
}

export function PenIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </Svg>
    );
}

export function ScanIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M7 12h10" />
        </Svg>
    );
}

export function LogOutIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
        </Svg>
    );
}

export function MusicIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </Svg>
    );
}

export function ShareIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.6 13.5 6.8 4" />
            <path d="m15.4 6.5-6.8 4" />
        </Svg>
    );
}

export function CheckIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M20 6 9 17l-5-5" />
        </Svg>
    );
}

export function XIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </Svg>
    );
}

export function ClockIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </Svg>
    );
}

export function UsersIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Svg>
    );
}

export function KeyIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <circle cx="7.5" cy="15.5" r="4.5" />
            <path d="m10.5 12.5 9-9" />
            <path d="m16 7 2 2" />
            <path d="m13 10 2 2" />
        </Svg>
    );
}

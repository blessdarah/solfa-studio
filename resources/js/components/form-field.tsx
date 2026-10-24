import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type FormFieldProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'value'
> & {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    hint?: string;
};

export function FormField({
    id,
    label,
    value,
    onChange,
    error,
    hint,
    className,
    ...props
}: FormFieldProps) {
    const describedBy = error
        ? `${id}-error`
        : hint
          ? `${id}-hint`
          : undefined;

    return (
        <div>
            <label
                htmlFor={id}
                className="mb-1.5 block text-[10px] font-semibold tracking-[0.12em] text-pencil uppercase"
            >
                {label}
            </label>
            <input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                className={cn(
                    'h-11 w-full rounded-[10px] border bg-paper px-3.5 text-[14px] text-ink outline-none transition',
                    'placeholder:text-pencil/55',
                    error
                        ? 'border-danger/50 focus:border-danger focus:ring-2 focus:ring-danger/10'
                        : 'border-rule focus:border-ink focus:ring-2 focus:ring-ink/10',
                    className,
                )}
                {...props}
            />
            {error ? (
                <p
                    id={`${id}-error`}
                    className="mt-1.5 text-[11.5px] leading-4 text-danger"
                >
                    {error}
                </p>
            ) : hint ? (
                <p
                    id={`${id}-hint`}
                    className="mt-1.5 text-[11.5px] leading-4 text-pencil"
                >
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

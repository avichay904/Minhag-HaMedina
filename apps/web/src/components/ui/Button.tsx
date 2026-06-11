import { forwardRef, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      className,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const base =
      'inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 select-none active:scale-95';

    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-lg shadow-brand-500/30 hover:brightness-110 disabled:opacity-50',
      secondary:
        'bg-white text-brand-900 border border-brand-100 shadow-sm hover:bg-brand-50 disabled:opacity-50',
      ghost:
        'bg-transparent text-brand-600 hover:bg-brand-50 disabled:opacity-40',
      danger:
        'bg-red-500 text-white shadow-md hover:bg-red-600 disabled:opacity-50',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'text-sm px-4 py-2 gap-1.5',
      md: 'text-base px-6 py-3 gap-2',
      lg: 'text-lg px-8 py-4 gap-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled ?? loading}
        className={clsx(
          base,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

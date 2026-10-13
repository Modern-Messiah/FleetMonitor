import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-semibold tracking-wide',
  {
    variants: {
      variant: {
        slate: 'border-white/20 text-[#d0d0d0]',
        yellow: 'border-[#e6c27a] text-[#e6c27a]',
        red: 'border-[var(--red)] text-[var(--red)]',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

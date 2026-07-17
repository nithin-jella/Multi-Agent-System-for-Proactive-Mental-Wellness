// src/components/ui/Button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot'; // Optional: for 'asChild' prop if needed later
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Define Button Variants using CVA
const buttonVariants = cva(
  // Base styles applied to all buttons
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Default UGM Style
        default: 'bg-ugm-blue text-ugm-gold hover:bg-ugm-blue-dark',
        // Destructive variant (example)
        destructive: 'bg-red-500 text-destructive-foreground hover:bg-red-500/90',
         // Outline variant (Glassy style from previous example)
         outline: 'border border-white/20 bg-white/10 text-ugm-gold hover:bg-white/20 backdrop-blur-sm',
        // Secondary/Subtle variant (example)
        secondary: 'bg-ugm-blue-light/20 text-ugm-blue-dark hover:bg-ugm-blue-light/30',
        // Ghost variant (example)
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        // Link variant (example)
        link: 'text-primary underline-offset-4 hover:underline',
        // Add the specific gold/blue variant for Send button
         primaryGold: 'bg-ugm-gold text-ugm-blue-dark hover:bg-ugm-gold/90 disabled:bg-ugm-gold/50',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10', // Specific size for icon buttons
      },
    },
    // Default variants if none are specified
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Extend ButtonProps to include CVA variants and optional 'asChild'
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean; // Optional: allows rendering as a different element (e.g., Link)
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Use Slot if asChild is true, otherwise use 'button'
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        // Apply CVA variants and any additional classNames
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants }; // Export variants if needed elsewhere
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50', {
  variants: { variant: { default: 'bg-primary text-primary-foreground hover:opacity-90', destructive: 'bg-destructive text-white hover:opacity-90', outline: 'border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground', secondary: 'bg-secondary text-secondary-foreground hover:opacity-80', ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground', link: 'text-primary underline-offset-4 hover:underline' }, size: { default: 'h-10 px-4 py-2', sm: 'h-8 rounded-sm px-3', lg: 'h-11 rounded-md px-6', icon: 'size-10 p-0' } },
  defaultVariants: { variant: 'default', size: 'default' },
})

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button }

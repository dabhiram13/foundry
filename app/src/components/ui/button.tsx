import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"
import { motion, type HTMLMotionProps } from "motion/react"
import { useStudioMotion } from "../studio-motion"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,opacity,transform] duration-[var(--motion-feedback)] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-input bg-background shadow-none hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  onClick,
  ...props
}: Omit<HTMLMotionProps<"button">, "children"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    children?: React.ReactNode
  }) {
  const { reduced } = useStudioMotion()
  const [ripple, setRipple] = React.useState<{ x: number; y: number; size: number; id: number } | null>(null)
  React.useEffect(() => {
    if (!ripple) return
    const timer = setTimeout(() => setRipple(null), 500)
    return () => clearTimeout(timer)
  }, [ripple])
  const classes = cn(buttonVariants({ variant, size, className }))
  if (asChild) return <Slot.Root data-slot="button" data-variant={variant} data-size={size} className={classes} onClick={onClick} {...props as React.ComponentProps<"button">}>{children}</Slot.Root>

  return (
    <motion.button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={classes}
      whileHover={reduced || props.disabled || variant === 'ghost' || variant === 'link' ? undefined : { scale: 1.015 }}
      whileTap={reduced || props.disabled ? undefined : { scale: .975 }}
      onClick={event => {
        if (!reduced && !props.disabled && variant === 'default') {
          const rect = event.currentTarget.getBoundingClientRect()
          const size = Math.max(rect.width, rect.height) * 2
          setRipple({ x: (event.detail ? event.clientX - rect.left : rect.width / 2) - size / 2, y: (event.detail ? event.clientY - rect.top : rect.height / 2) - size / 2, size, id: Date.now() })
        }
        onClick?.(event)
      }}
      {...props}
    >{children}{ripple && !reduced && <motion.span aria-hidden="true" className="button-ripple" key={ripple.id} style={{ left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size }} initial={{ scale: 0, opacity: .2 }} animate={{ scale: 1, opacity: 0 }} transition={{ duration: .45 }}/>}</motion.button>
  )
}

export { Button, buttonVariants }

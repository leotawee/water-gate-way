import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/* The app's one button language (matches the retired btn-* utilities): the default variant is the
   screen's ONE primary action, in brand blue (accent is the interaction colour; ink stays for
   text/structure), outlined secondary, quiet ghost rows, danger as an outlined soft tone — destructive
   stays the danger voice. Focus is the global 2px accent outline from globals.css — no per-component
   ring. Touch floor: 44px (h-11) on every size. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors duration-(--dur-base) select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-60 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent/85",
        outline: "border border-input bg-surface text-fg hover:bg-surface-2",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-fg hover:bg-surface-2",
        ghostDanger: "text-destructive hover:bg-danger-soft",
        destructive: "border border-destructive bg-surface text-destructive hover:bg-danger-soft",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 gap-1.5 px-3",
        lg: "h-11 px-6",
        icon: "size-11",
        "icon-sm": "size-9",
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
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

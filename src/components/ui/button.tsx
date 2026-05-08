import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base: shared across all variants
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-all duration-100 outline-none select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary — amber-600, white text, amber-700 border
        default:
          "bg-amber-600 text-white border border-amber-700 shadow-sm hover:bg-amber-700 active:bg-amber-800",

        // Secondary — transparent, slate-700 text, slate-300 border
        outline:
          "bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-800",

        // Subtle secondary — slate background
        secondary:
          "bg-slate-100 text-slate-700 border border-transparent hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600",

        // Ghost — no border, minimal
        ghost:
          "bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",

        // Destructive
        destructive:
          "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",

        // Link
        link: "text-amber-600 underline-offset-4 hover:underline dark:text-amber-400",
      },
      size: {
        default: "h-9 gap-1.5 px-4 rounded text-sm",
        xs:      "h-6 gap-1   px-2 rounded-sm text-xs",
        sm:      "h-8 gap-1.5 px-3 rounded text-sm",
        lg:      "h-10 gap-2  px-5 rounded text-sm",
        icon:    "size-9 rounded",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded",
        "icon-lg": "size-10 rounded",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

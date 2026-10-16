import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline: "border-border text-foreground hover:bg-muted",
        ghost: "border-transparent hover:bg-muted hover:text-muted-foreground",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        queued: "border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15",
        building: "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15",
        ready: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15",
        failed: "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/15",
        canceled: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }

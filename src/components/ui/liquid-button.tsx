import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export interface LiquidButtonProps
  extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  children?: React.ReactNode;
  fullWidth?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
  icon: "h-10 w-10",
};

const variantBg: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(135deg,oklch(0.72_0.22_28/0.98),oklch(0.6_0.24_22/0.98))]",
  ghost:
    "bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))]",
  outline:
    "bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))]",
};

/**
 * Liquid Glass button — iOS 26 inspired.
 * Frosted backdrop, iridescent border, top-left specular highlight,
 * soft radiating shadow, spring hover with subtle shine sweep.
 */
export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, variant = "primary", size = "md", children, fullWidth, disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileHover={disabled ? undefined : { scale: 1.03 }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 22, mass: 0.6 }}
        className={cn(
          "group relative inline-flex items-center justify-center gap-2 rounded-full font-medium",
          "isolate select-none whitespace-nowrap",
          variant === "primary" ? "text-white" : "text-foreground",
          "backdrop-blur-[20px] backdrop-saturate-[180%]",
          "shadow-[0_8px_24px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(99,102,241,0.18)]",
          "transition-shadow duration-300",
          "hover:shadow-[0_14px_40px_-8px_rgba(236,72,153,0.28),0_4px_14px_-2px_rgba(99,102,241,0.25)]",
          "disabled:opacity-50 disabled:pointer-events-none",
          "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          sizeClasses[size],
          fullWidth && "w-full",
          variantBg[variant],
          className,
        )}
        style={{
          textShadow:
            variant === "primary"
              ? "0 1px 2px rgba(0,0,0,0.25)"
              : "0 1px 1px rgba(255,255,255,0.6)",
          ...(props.style ?? {}),
        }}
        {...props}
      >
        {/* Iridescent gradient border (mask trick) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full p-[1px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(125,160,255,0.55) 35%, rgba(255,140,200,0.55) 70%, rgba(255,255,255,0.7))",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        {/* Specular highlight top-left */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full overflow-hidden"
        >
          <span
            className="absolute -top-1/2 -left-1/4 h-full w-2/3 rounded-full opacity-70 blur-md"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,255,255,0.8), rgba(255,255,255,0) 70%)",
            }}
          />
        </span>
        {/* Shine sweep on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full overflow-hidden"
        >
          <span
            className="absolute top-0 -left-full h-full w-1/2 -skew-x-12 transition-all duration-700 ease-out group-hover:left-[120%]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
            }}
          />
        </span>
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </motion.button>
    );
  },
);
LiquidButton.displayName = "LiquidButton";
import type { ComponentPropsWithoutRef } from "react"

type LogoProps = ComponentPropsWithoutRef<"svg"> & {
  title?: string
}

export function Logo({ title, ...props }: LogoProps) {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <circle
        cx="60"
        cy="60"
        r="50"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.95"
      />
      <circle
        cx="60"
        cy="60"
        r="35"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeOpacity="0.9"
      />
      <path
        d="M60 15V30"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M60 90V105"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M15 60C20 45 30 35 45 30"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.75"
        strokeDasharray="2 1"
      />
      <path
        d="M105 60C100 75 90 85 75 90"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.75"
        strokeDasharray="2 1"
      />
      <circle
        cx="60"
        cy="60"
        r="3.4"
        fill="currentColor"
        fillOpacity="0.95"
      />
    </svg>
  )
}

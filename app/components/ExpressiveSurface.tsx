import React from "react";

type ExpressiveSurfaceProps = {
  className?: string;
};

export default function ExpressiveSurface({ className = "" }: ExpressiveSurfaceProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 ${className}`}
    >
      <div className="absolute inset-0 bg-expressive opacity-75 dark:opacity-55" />
      <div className="absolute left-1/2 top-6 h-40 w-40 -translate-x-[120%] rounded-[42%] bg-[radial-gradient(circle_at_30%_30%,rgba(255,140,110,0.35),transparent_65%)] blur-2xl animate-float-slow" />
      <div className="absolute left-1/2 top-8 h-44 w-44 translate-x-[35%] rounded-[46%] bg-[radial-gradient(circle_at_35%_30%,rgba(90,139,255,0.32),transparent_65%)] blur-3xl animate-float-slow" />
      <div className="absolute left-1/2 top-20 h-28 w-28 -translate-x-1/2 rounded-[38%] bg-[radial-gradient(circle_at_30%_30%,rgba(255,205,150,0.3),transparent_65%)] blur-2xl" />
    </div>
  );
}

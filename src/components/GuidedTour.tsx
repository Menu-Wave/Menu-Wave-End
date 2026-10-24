import { useEffect, useMemo, useState } from "react";

type GuidedTourProps = {
  open: boolean;
  storageKey: string;
  onClose: () => void;
};

type TourStep = {
  title: string;
  description: string;
  targetId?: string;
};

export function GuidedTour({ open, storageKey, onClose }: GuidedTourProps) {
  const steps = useMemo<TourStep[]>(
    () => [
      {
        title: "Welcome to Menu-Wave",
        description:
          "Your restaurant management workspace is ready. Here is a quick tour of the tools you will use to run your restaurant.",
      },
      {
        title: "Restaurant Settings",
        description:
          "Upload or replace your restaurant logo here. It is used on your customer ordering experience and table QR materials.",
        targetId: "tour-restaurant-settings",
      },
      {
        title: "Menu Management",
        description:
          "Create categories, add meals, upload food photos and control which items customers can currently order.",
        targetId: "tour-menu-management",
      },
      {
        title: "Cashier",
        description:
          "Open the cashier workspace to receive customer orders, confirm payments and manage the front-of-house order flow.",
        targetId: "tour-cashier",
      },
      {
        title: "Kitchen",
        description:
          "The kitchen workspace shows actionable orders and lets your team move them through preparation until they are ready.",
        targetId: "tour-kitchen",
      },
      {
        title: "Staff",
        description:
          "Invite managers, cashiers and kitchen workers here and give each person access to the tools required for their role.",
        targetId: "tour-staff",
      },
      {
        title: "You're ready to go",
        description:
          "Add your menu, invite your team and test an order. Once those are ready, customers can start ordering with Menu-Wave.",
      },
    ],
    []
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updateTarget = () => {
      if (!step.targetId) {
        setTargetRect(null);
        return;
      }

      const target = document.getElementById(step.targetId);
      if (!target) {
        setTargetRect(null);
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });

      window.setTimeout(() => {
        setTargetRect(target.getBoundingClientRect());
      }, 320);
    };

    updateTarget();
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);

    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [open, step]);

  if (!open) return null;

  const finishTour = () => {
    window.localStorage.setItem(storageKey, "completed");
    onClose();
  };

  const closeForNow = () => {
    onClose();
  };

  const spotlightStyle = targetRect
    ? {
        top: Math.max(8, targetRect.top - 8),
        left: Math.max(8, targetRect.left - 8),
        width: Math.min(window.innerWidth - 16, targetRect.width + 16),
        height: targetRect.height + 16,
      }
    : null;

  const cardStyle =
    targetRect && window.innerWidth >= 640
      ? {
          top:
            targetRect.bottom + 220 < window.innerHeight
              ? Math.min(window.innerHeight - 210, targetRect.bottom + 18)
              : Math.max(18, targetRect.top - 205),
          left: Math.min(
            window.innerWidth - 390,
            Math.max(18, targetRect.left + targetRect.width / 2 - 180)
          ),
        }
      : undefined;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px]" />

      {spotlightStyle && (
        <div
          className="pointer-events-none fixed z-[101] rounded-2xl border-2 border-blue-400 shadow-[0_0_0_9999px_rgba(2,6,23,0.18),0_0_35px_rgba(56,189,248,0.45)] transition-all duration-300"
          style={spotlightStyle}
        />
      )}

      <div
        className={`fixed z-[102] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl ${
          targetRect ? "bottom-4 left-4 sm:bottom-auto" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        }`}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Menu-Wave management tour"
      >
        <button
          type="button"
          onClick={closeForNow}
          className="absolute right-4 top-3 text-xl text-slate-400 hover:text-white"
          aria-label="Close tour for now"
        >
          ×
        </button>

        <div className="pr-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">
            {stepIndex + 1} of {steps.length}
          </p>
          <h2 className="mt-2 text-xl font-extrabold">{step.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finishTour}
            className="text-sm font-semibold text-slate-400 hover:text-white"
          >
            Skip tour
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={isFirst}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLast) finishTour();
                else setStepIndex((current) => Math.min(steps.length - 1, current + 1));
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500"
            >
              {isLast ? "Finish tour" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

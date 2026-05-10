/**
 * About overlay — styled after progharshith/wuhdul's about page.
 * Author: progharshith (https://github.com/progharshith)
 */

import { useEffect, useState } from "react";

interface AboutProps {
  onClose: () => void;
}

export function About({ onClose }: AboutProps) {
  const [visible, setVisible] = useState(false);

  // Trigger the enter animation on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  return (
    <div className="absolute inset-0 z-30 bg-[#111] font-mono overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <span className="text-sm font-bold tracking-widest text-neutral-100 uppercase">
          Type Siege
        </span>
        <button
          onClick={handleClose}
          className="text-[11px] uppercase tracking-[0.3em] text-neutral-400 hover:text-neutral-100 transition-colors"
        >
          Back
        </button>
      </div>

      {/* Content — fades and slides up on open */}
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 250ms ease-out, transform 250ms ease-out",
        }}
      >
        <div className="max-w-2xl px-12 py-16 space-y-6 text-neutral-100 text-[15px] leading-relaxed">
          <h1 className="text-2xl font-bold">about</h1>

          <p>hey, i'm harshith.</p>

          <p>
            i'm 19, a first year cs student. i spend most of my time building
            things, mostly small web projects that i find interesting.
          </p>

          <p>
            i like working on clean interfaces, simple ideas, and turning them
            into something usable. type siege is one of those projects, just
            something i built and kept refining.
          </p>

          <p>
            outside of that, i've been involved in leadership roles,
            volunteering, and sports.
          </p>

          <div className="pt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-neutral-100">
              Links
            </p>
            <p>
              github:{" "}
              <a
                href="https://github.com/progharshith"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-neutral-400 transition-colors"
              >
                https://github.com/progharshith
              </a>
            </p>
            <p>
              linkedin:{" "}
              <a
                href="https://www.linkedin.com/in/harshithgupta"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-neutral-400 transition-colors"
              >
                https://www.linkedin.com/in/harshithgupta
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

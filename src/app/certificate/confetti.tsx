"use client";

import { useEffect, useRef } from "react";

/** Brand palette: the certificate's navy and gold with the site's warm tones. */
const COLOURS = ["#e3c46a", "#d8792d", "#8a2f2a", "#101f3c", "#f0d68b", "#b7e0c4"];

const PIECE_COUNT = 90;
const FALL_MS = 6000;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  tilt: number;
  spin: number;
  colour: string;
};

/**
 * A one-shot confetti fall over the page, for arriving on a page that celebrates
 * a world record.
 *
 * Canvas rather than DOM nodes so a hundred pieces cost one element, fixed and
 * pointer-events-none so it never intercepts a tap on the form underneath, and
 * skipped outright when the visitor has asked for reduced motion.
 */
export default function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const pieces: Piece[] = Array.from({ length: PIECE_COUNT }, () => ({
      x: Math.random() * width,
      /**
       * Spread from just above the fold to one screen higher, and paired with a
       * speed that crosses that whole distance inside FALL_MS. Starting them
       * further up, or falling slower, leaves most of the confetti still above
       * the viewport when the animation ends — visible to no one.
       */
      y: -Math.random() * height,
      vx: -0.5 + Math.random(),
      vy: 4 + Math.random() * 4,
      size: 5 + Math.random() * 6,
      tilt: Math.random() * Math.PI,
      spin: -0.08 + Math.random() * 0.16,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    }));

    let frame = 0;
    /**
     * Set on the first painted frame, not at mount. requestAnimationFrame does not
     * fire while the tab is hidden, so timing from mount lets the whole fall expire
     * unseen when the page is opened in a background tab.
     */
    let started: number | null = null;

    const draw = (now: number) => {
      if (started === null) started = now;
      const elapsed = now - started;
      ctx.clearRect(0, 0, width, height);

      // Fade the whole fall out over its last second rather than cutting it off.
      const remaining = FALL_MS - elapsed;
      ctx.globalAlpha = remaining < 1000 ? Math.max(remaining / 1000, 0) : 1;

      let visible = false;
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.tilt += p.spin;
        if (p.y < height + 20) visible = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tilt);
        ctx.fillStyle = p.colour;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < FALL_MS && visible) {
        frame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}

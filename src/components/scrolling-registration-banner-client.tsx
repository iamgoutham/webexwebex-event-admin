"use client";

/**
 * Horizontal ticker; duplicates message for a seamless loop. Respects
 * `prefers-reduced-motion` with a static centered line.
 */
export default function ScrollingRegistrationBannerClient({
  message,
}: {
  message: string;
}) {
  const gap = "     •     ";

  return (
    <div
      role="status"
      className="rounded-2xl border border-[#c45c3a] bg-gradient-to-r from-[#fde8dc] via-[#fff4df] to-[#fde8dc] py-3 shadow-md sm:py-4"
    >
      <p className="hidden px-4 text-center text-sm font-semibold leading-snug text-[#5c2418] motion-reduce:block sm:text-base">
        {message}
      </p>
      <div
        className="motion-reduce:hidden overflow-hidden"
        aria-hidden="true"
      >
        <div className="landing-banner-marquee-track flex w-max text-sm font-semibold leading-snug text-[#5c2418] sm:text-base">
          <span className="flex shrink-0 items-center px-4">
            {message}
            <span className="text-[#8a5b44]">{gap}</span>
          </span>
          <span className="flex shrink-0 items-center px-4">
            {message}
            <span className="text-[#8a5b44]">{gap}</span>
          </span>
        </div>
      </div>
      <span className="sr-only">{message}</span>
    </div>
  );
}

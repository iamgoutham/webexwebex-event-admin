/**
 * Webex host training embed + download (id=host-training for /dashboard#host-training).
 */
export default function HostTrainingSection({
  presentationEmbedSrc,
}: {
  presentationEmbedSrc: string | null;
}) {
  return (
    <section
      id="host-training"
      className="rounded-2xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-md sm:p-8"
    >
      <span className="inline-flex rounded-full bg-[#f7e2b6] px-3 py-1 text-xs font-semibold text-[#8a2f2a]">
        Training
      </span>
      <h2 className="mt-4 text-xl font-semibold">
        <a
          href="/webex-host-training.pptx"
          download="webex-host-training.pptx"
          className="text-[#3b1a1f] underline decoration-[#c58d5d] decoration-2 underline-offset-4 hover:text-[#8a2f2a]"
        >
          Webex Host Training
        </a>
      </h2>
      <p className="mt-2 text-sm text-[#6b4e3d]">
        Watch the host training slideshow below. Use the controls in the viewer
        to move between slides, or download the presentation from the title link.
      </p>
      {presentationEmbedSrc ? (
        <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl border border-[#e5c18e] bg-[#f7e2b6]">
          <iframe
            src={presentationEmbedSrc}
            title="Webex Host Training presentation"
            className="h-full min-h-[360px] w-full"
            allowFullScreen
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#6b4e3d]">
          Set <code className="rounded bg-[#f7e2b6] px-1">NEXTAUTH_URL</code> to
          your site’s public URL for the embedded slideshow. Until then, use the
          title link to download the file.
        </p>
      )}
      <p className="mt-4 text-xs text-[#6b4e3d]">
        If the slideshow does not load (e.g. in local development),{" "}
        <a
          href="/webex-host-training.pptx"
          download="webex-host-training.pptx"
          className="font-semibold text-[#7a3b2a] underline hover:text-[#5a2b1a]"
        >
          download the presentation
        </a>
        .
      </p>
    </section>
  );
}

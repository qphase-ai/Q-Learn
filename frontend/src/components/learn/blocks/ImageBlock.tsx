import type { BlockProps } from "./types";

const SAFE_URL = /^(https?:\/\/|\/)/i;

export default function ImageBlock({ image, caption }: BlockProps<"image">) {
  // An unpopulated relation (bare id) or a non-http URL is not renderable.
  if (!image || typeof image !== "object" || !image.url || !SAFE_URL.test(image.url)) return null;
  return (
    <figure className="my-6">
      {/* Media is served by the CMS/Supabase Storage, outside next/image's configured hosts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.alt ?? ""}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading="lazy"
        className="mx-auto h-auto max-w-full rounded-md border border-overlay/10"
      />
      {caption && <figcaption className="mt-2 text-center text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

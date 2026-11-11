import Image from "next/image";

// Source image is 717×314; keep that ratio at any height.
const RATIO = 717 / 314;

export function BrandLogo({ height = 32, className = "", priority = false }) {
  return (
    <Image
      src="/txtit-logo.png"
      alt="TxtIt"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

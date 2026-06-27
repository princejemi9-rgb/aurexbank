import { useBranding } from "../../context/BrandingContext";

type AurexMarkProps = {
  className?: string;
  imageClassName?: string;
  label?: string;
};

type AurexBrandProps = {
  className?: string;
  markClassName?: string;
  titleClassName?: string;
  taglineClassName?: string;
  showTagline?: boolean;
};

export function AurexMark({
  className = "h-10 w-10 rounded-lg",
  imageClassName = "p-1",
  label,
}: AurexMarkProps) {
  const { branding } = useBranding();
  const logoUrl = branding.logoUrl || "/aurex-bank-logo.svg";

  return (
    <span
      role="img"
      aria-label={label ?? branding.bankName}
      className={`brand-glow-md flex shrink-0 items-center justify-center overflow-hidden border border-green-400/25 bg-[var(--brand-surface)] ${className}`}
    >
      {branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          className={`h-full w-full object-contain ${imageClassName}`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`h-full w-full bg-green-400 ${imageClassName}`}
          style={{
            WebkitMaskImage: "url(/aurex-bank-logo.svg)",
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskImage: "url(/aurex-bank-logo.svg)",
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "contain",
          }}
        />
      )}
    </span>
  );
}

export default function AurexBrand({
  className = "",
  markClassName = "h-14 w-14 rounded-xl",
  titleClassName = "text-3xl",
  taglineClassName = "text-sm",
  showTagline = true,
}: AurexBrandProps) {
  const { branding } = useBranding();

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <AurexMark className={markClassName} label={branding.bankName} />
      <div className="min-w-0">
        <h1 className={`truncate font-black tracking-tight text-white ${titleClassName}`}>
          {branding.bankName}
        </h1>
        {showTagline && (
          <p className={`mt-1 truncate text-zinc-500 ${taglineClassName}`}>
            Private Digital Banking
          </p>
        )}
      </div>
    </div>
  );
}

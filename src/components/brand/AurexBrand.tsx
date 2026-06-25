import Image from "next/image";

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
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-green-400/25 bg-[#070908] shadow-[0_0_32px_rgba(74,222,128,0.18)] ${className}`}
    >
      <Image
        src="/aurex-bank-logo.svg"
        alt={label ?? ""}
        aria-hidden={label ? undefined : true}
        width={512}
        height={512}
        unoptimized
        className={`h-full w-full object-contain ${imageClassName}`}
      />
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
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <AurexMark className={markClassName} label="Aurex Bank" />
      <div className="min-w-0">
        <h1 className={`truncate font-black tracking-tight text-white ${titleClassName}`}>
          Aurex Bank
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

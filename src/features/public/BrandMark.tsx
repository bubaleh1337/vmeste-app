type BrandMarkProps = {
  large?: boolean;
};

export function BrandMark({ large = false }: BrandMarkProps) {
  return (
    <span className={`brand-mark${large ? " large" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <rect className="brand-link brand-link-first" x="7" y="20" width="34" height="24" rx="12" />
        <rect className="brand-link brand-link-second" x="23" y="20" width="34" height="24" rx="12" />
      </svg>
    </span>
  );
}

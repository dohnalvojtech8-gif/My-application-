import { useState, useEffect } from "react";
import { call } from "./Settings";
export function Brands({ onSelect }: { onSelect: (b: any) => void }) {
  const [brands, setBrands] = useState<any[]>([]);
  useEffect(() => {
    call("/brands")
      .then(setBrands)
      .catch(() => {});
  }, []);
  return (
    <div>
      <h3>Značkové ikony</h3>
      <div className="item-grid">
        {brands.map((b) => (
          <button type="button" key={b.slug} onClick={() => onSelect(b)}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={b.color}
              aria-hidden="true"
            >
              <path d={b.path} />
            </svg>
            {b.name}
          </button>
        ))}
      </div>
      <small>
        Simple Icons (CC0); ochranné známky patří jejich vlastníkům. Pravidla
        použití ověřte u značky.
      </small>
    </div>
  );
}

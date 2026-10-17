import { cls } from "./ui";

type SegmentedProps<T> = {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange(value: T): void;
};

export function Segmented<T extends string | number>({ label, value, options, onChange }: SegmentedProps<T>) {
  const hint = options.find((o) => o.value === value)?.hint;
  return (
    <div className="segmented">
      <div className="segmented__label">{label}</div>
      <div className="segmented__options" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={o.value === value}
            className={cls("segmented__option", o.value === value && "segmented__option--active")}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <div className="segmented__hint">{hint}</div>}
    </div>
  );
}

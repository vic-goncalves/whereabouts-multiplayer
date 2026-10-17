type IconProps = { size?: number };

const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const FlagIcon = ({ size = 20 }: IconProps) =>
  svg(size, <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>);

export const UndoIcon = ({ size = 20 }: IconProps) =>
  svg(size, <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>);

export const CheckpointIcon = ({ size = 20 }: IconProps) =>
  svg(size, <><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="10" r="2.5" /></>);

export const PlusIcon = ({ size = 20 }: IconProps) => svg(size, <><path d="M12 5v14" /><path d="M5 12h14" /></>);

export const MinusIcon = ({ size = 20 }: IconProps) => svg(size, <path d="M5 12h14" />);

export const PinIcon = ({ size = 16 }: IconProps) =>
  svg(size, <><path d="M12 17v5" /><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3Z" /></>);

export const CloseIcon = ({ size = 18 }: IconProps) => svg(size, <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>);

export const MapIcon = ({ size = 22 }: IconProps) =>
  svg(size, <><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14" /><path d="M15 6v14" /></>);

export const LinkIcon = ({ size = 18 }: IconProps) =>
  svg(size, <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>);

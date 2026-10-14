import type { ReactNode, SVGProps } from "react";

/**
 * The icon set.
 *
 * Every glyph in the app is one of these, drawn on a 24-unit grid as open
 * strokes — no fills, no two-weight pairs. That is what lets a 20px icon sit
 * inside a coloured disc, on a purple card and on a white one without any of
 * the three needing a different version of the same picture.
 *
 * They are written out as paths rather than pulled from an icon library
 * because the set is small, fixed, and the whole point of it is that the
 * strokes match: a borrowed bell next to a hand-drawn coin reads as two
 * different apps.
 *
 * Sized in `em`-free pixels with a default of 20 so a caller can drop one in
 * anywhere and get the reference's weight without thinking about it.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
}

function Icon({
  size = 20,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />
    </Icon>
  );
}

export function VaultIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5v-1M12 16.5v-1" />
    </Icon>
  );
}

export function SpendIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </Icon>
  );
}

export function BackIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Icon>
  );
}

export function BellIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4" />
    </Icon>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 8h16M4 16h10" />
    </Icon>
  );
}

export function SendIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 17L17 7M8 7h9v9" />
    </Icon>
  );
}

export function RequestIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M17 7L7 17M16 17H7V8" />
    </Icon>
  );
}

export function ReceiveIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </Icon>
  );
}

export function BorrowIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11M15 9c-.5-1.2-5.5-1.5-5.5 1 0 2.8 5.5 1.2 5.5 4 0 2.4-5 2.2-5.5.9" />
    </Icon>
  );
}

export function MoreIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </Icon>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </Icon>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 4a4 4 0 010 8" />
    </Icon>
  );
}

export function QrIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 20h2" />
    </Icon>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </Icon>
  );
}

export function HelpIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .6-1.5 1-1.5 2M12 17h0" />
    </Icon>
  );
}

/**
 * A cog, not a sun.
 *
 * This used to be a ring with eight straight rays around it, which at 20px is
 * a brightness control, not settings — and in this app there is a real
 * brightness-shaped control one tap away, so the wrong reading was the likely
 * one. A cog with the notched outline is unambiguous at any size.
 */
export function GearIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  );
}

export function UserIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </Icon>
  );
}

export function AtSignIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-4 8" />
    </Icon>
  );
}

export function BriefcaseIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18" />
    </Icon>
  );
}

export function MailIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </Icon>
  );
}

export function ShieldIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h0" />
    </Icon>
  );
}

export function EditIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
    </Icon>
  );
}

export function OutIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
    </Icon>
  );
}

export function MoonIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20 14A8 8 0 1110 4a7 7 0 0010 10z" />
    </Icon>
  );
}

/** The tick used by the success circle and the verified pill. */
export function CheckIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Icon>
  );
}

/** A close, for a sheet, a search field, a dismissal. */
export function XIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

/** The trailing chevron on a row that leads somewhere. */
export function ChevronRightIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M9 5l7 7-7 7" />
    </Icon>
  );
}

/** The trailing chevron on a control that opens a picker. */
export function ChevronDownIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 9l7 7 7-7" />
    </Icon>
  );
}

/** A problem worth telling the user about. */
export function AlertIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h0" />
    </Icon>
  );
}

/** Try again. */
export function RefreshIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20 12a8 8 0 11-2.3-5.6" />
      <path d="M20 4v5h-5" />
    </Icon>
  );
}

/** No connection. */
export function OfflineIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M2 2l20 20" />
      <path d="M8.5 16.5a5 5 0 017 0M5 13a10 10 0 013-1.7M19 13a10 10 0 00-3-1.7M12 20h0" />
    </Icon>
  );
}

/**
 * The clock a pending receipt shows.
 *
 * Pending is a real state in this app — a request that has been sent and not
 * answered is not a failure, and drawing it in the same red as one would be a
 * lie about what happened.
 */
export function ClockIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

/**
 * Backspace.
 *
 * The one key on the amount pad that is not a character. Drawn as the
 * outlined-left chevron with an X inside it rather than a bare arrow, because
 * an arrow alone next to digits reads as "previous" rather than "delete".
 */
export function DeleteIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20 6H9l-5 6 5 6h11a1 1 0 001-1V7a1 1 0 00-1-1z" />
      <path d="M13 10l4 4M17 10l-4 4" />
    </Icon>
  );
}


/* --------------------------------------------------------------------------
   Added by the vocabulary sweep.
   --------------------------------------------------------------------------
   The merchant and ledger screens arrived from the previous build importing
   their glyphs from an icon library. A borrowed glyph next to a drawn one is
   the exact mismatch this file exists to prevent, so the missing shapes are
   drawn here in the same idiom rather than aliased to the nearest neighbour:
   a "copy" is not a "receipt", and a crossed-out bell is not a bell.
   -------------------------------------------------------------------------- */

/** Not allowed. A slash through a ring, for a control that is switched off. */
export function BanIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </Icon>
  );
}

/** Notifications muted. The bell with the same slash through it. */
export function BellOffIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 16V11a6 6 0 019.4-4.9M18 11v5l2 2H8M10 21h4" />
      <path d="M4 4l16 16" />
    </Icon>
  );
}

/** Copy to the clipboard. Two offset sheets, the front one squared off. */
export function CopyIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1" />
    </Icon>
  );
}

/** A document. Used for anything that is a record rather than a payment. */
export function DocIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Icon>
  );
}

/** A receipt. The document with a torn lower edge and a total on it. */
export function ReceiptIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 3v18l2.5-1.6L10 21l2-1.6L14 21l2.5-1.6L19 21V3z" />
      <path d="M9 8h6M9 12h6" />
    </Icon>
  );
}

/** Undo. An arrow doubling back over an arc. */
export function UndoIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 9h11a5 5 0 010 10h-6" />
      <path d="M8 5L4 9l4 4" />
    </Icon>
  );
}

/**
 * A link.
 *
 * Two hooks passing through each other, which is a link and not a chain — a
 * chain draws as a row of identical rings and at 16px that is a dotted line.
 * The misalignment between the two halves is what makes the shape readable.
 */
export function LinkIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M10.5 13.5a4 4 0 006 .5l2-2a4 4 0 10-5.7-5.7l-1.1 1.1" />
      <path d="M13.5 10.5a4 4 0 00-6-.5l-2 2a4 4 0 105.7 5.7l1.1-1.1" />
    </Icon>
  );
}

/** The platform share sheet. Three nodes joined by two strokes. */
export function ShareIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="17" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="17" cy="19" r="2.5" />
      <path d="M8.2 10.8l6.6-3.6M8.2 13.2l6.6 3.6" />
    </Icon>
  );
}

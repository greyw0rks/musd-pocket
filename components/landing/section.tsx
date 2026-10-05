import { cn } from "@/lib/utils";

/** Standard landing section shell: centred, generous vertical rhythm. */
export function Section({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20 sm:py-28",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/** Small orange kicker above a section title. */
export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "text-[13px] font-semibold uppercase tracking-[0.18em] text-mezo",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SectionTitle({
  className,
  children,
  as: Tag = "h2",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <Tag
      className={cn(
        "text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[44px] lg:leading-[1.1]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionLead({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("text-lg text-muted text-pretty", className)}>
      {children}
    </p>
  );
}

/** Every MUSD figure gets the same treatment — that recognition is the point. */
export function Amount({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("tabular font-semibold", className)}>{children}</span>
  );
}

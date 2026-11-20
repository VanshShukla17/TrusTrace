import { Broadcast, CalendarBlank, Clock, Database } from "@phosphor-icons/react";

export type ProvenanceLabel =
  | "Real"
  | "Real · Live Feed"
  | "Real · Dated Snapshot"
  | "Real · YouTube Official RSS"
  | "Synthetic / Demo"
  | "Mixed (Labelled)"
  | "Curated Demo · Mixed";

export interface ProvenancePillProps {
  label: ProvenanceLabel;
  asOfDate?: string;
  fetchedAtIso?: string | null;
}

function formatIstTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso.slice(11, 19);
  }
}

export function ProvenancePill({ label, asOfDate, fetchedAtIso }: ProvenancePillProps) {
  const isReal = label.startsWith("Real");
  const isLive = label === "Real · Live Feed" || label === "Real · YouTube Official RSS";
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#6E7771]">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
          isReal
            ? "border border-[rgba(31,77,58,0.16)] bg-[#E6F2EC] text-[#1F4D3A]"
            : "border border-[rgba(22,26,24,0.09)] bg-[#EFECE6] text-[#4A524D]"
        }`}
      >
        {isLive ? (
          <Broadcast size={12} weight="duotone" aria-hidden="true" />
        ) : (
          <Database size={12} weight="regular" aria-hidden="true" />
        )}
        {label}
      </span>
      {fetchedAtIso ? (
        <span className="tabular-nums-lining inline-flex items-center gap-1 text-[11.5px] text-[#6E7771]">
          <Clock size={12} weight="regular" aria-hidden="true" />
          Updated {formatIstTime(fetchedAtIso)} IST
        </span>
      ) : asOfDate ? (
        <span className="tabular-nums-lining inline-flex items-center gap-1 text-[11.5px] text-[#6E7771]">
          <CalendarBlank size={12} weight="regular" aria-hidden="true" />
          As of {asOfDate}
        </span>
      ) : null}
    </span>
  );
}

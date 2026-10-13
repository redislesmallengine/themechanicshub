// Canadian provinces/territories — this pilot (Red Isle Small Engine) is
// PEI-based and the plan is Canada-first; Phase 10's generalization can
// widen this if/when a shop outside Canada signs up.
export const CANADIAN_PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
] as const;

/** The time zone a shop in each province keeps its books in -- used to decide where a day, month or year starts in reports. */
export const PROVINCE_TIME_ZONES: Record<string, string> = {
  Alberta: "America/Edmonton",
  "British Columbia": "America/Vancouver",
  Manitoba: "America/Winnipeg",
  "New Brunswick": "America/Moncton",
  "Newfoundland and Labrador": "America/St_Johns",
  "Northwest Territories": "America/Yellowknife",
  "Nova Scotia": "America/Halifax",
  Nunavut: "America/Iqaluit",
  Ontario: "America/Toronto",
  "Prince Edward Island": "America/Halifax",
  Quebec: "America/Toronto",
  Saskatchewan: "America/Regina",
  Yukon: "America/Whitehorse",
};

export function timeZoneForProvince(province: string | null | undefined): string {
  return (province && PROVINCE_TIME_ZONES[province]) || "America/Halifax";
}

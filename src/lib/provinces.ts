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

/** US states and the main time zone each keeps its books in (a few states span two; the larger part is used). */
export const US_STATE_TIME_ZONES: Record<string, string> = {
  Alabama: "America/Chicago", Alaska: "America/Anchorage", Arizona: "America/Phoenix", Arkansas: "America/Chicago",
  California: "America/Los_Angeles", Colorado: "America/Denver", Connecticut: "America/New_York", Delaware: "America/New_York",
  "District of Columbia": "America/New_York", Florida: "America/New_York", Georgia: "America/New_York", Hawaii: "Pacific/Honolulu",
  Idaho: "America/Boise", Illinois: "America/Chicago", Indiana: "America/Indiana/Indianapolis", Iowa: "America/Chicago",
  Kansas: "America/Chicago", Kentucky: "America/New_York", Louisiana: "America/Chicago", Maine: "America/New_York",
  Maryland: "America/New_York", Massachusetts: "America/New_York", Michigan: "America/Detroit", Minnesota: "America/Chicago",
  Mississippi: "America/Chicago", Missouri: "America/Chicago", Montana: "America/Denver", Nebraska: "America/Chicago",
  Nevada: "America/Los_Angeles", "New Hampshire": "America/New_York", "New Jersey": "America/New_York", "New Mexico": "America/Denver",
  "New York": "America/New_York", "North Carolina": "America/New_York", "North Dakota": "America/Chicago", Ohio: "America/New_York",
  Oklahoma: "America/Chicago", Oregon: "America/Los_Angeles", Pennsylvania: "America/New_York", "Rhode Island": "America/New_York",
  "South Carolina": "America/New_York", "South Dakota": "America/Chicago", Tennessee: "America/Chicago", Texas: "America/Chicago",
  Utah: "America/Denver", Vermont: "America/New_York", Virginia: "America/New_York", Washington: "America/Los_Angeles",
  "West Virginia": "America/New_York", Wisconsin: "America/Chicago", Wyoming: "America/Denver",
};

export const US_STATES = Object.keys(US_STATE_TIME_ZONES);

export function timeZoneForProvince(province: string | null | undefined): string {
  return (province && (PROVINCE_TIME_ZONES[province] ?? US_STATE_TIME_ZONES[province])) || "America/Halifax";
}

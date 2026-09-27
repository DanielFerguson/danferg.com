/** Claim-type labels used by <Tag /> and <TagLegend />. They mirror the article's own distinctions. */
export const tagKinds = {
  promise: { label: "Promise", help: "Announced or committed to; not yet delivered." },
  funded: { label: "Funded", help: "Money allocated in a budget or announcement; not yet spent or delivered." },
  delivered: { label: "Delivered", help: "Built, opened, operating or in force." },
  outcome: { label: "Outcome", help: "A measured result for people, not just something that exists." },
  govt: { label: "Government figure", help: "The government’s own count or claim, not independently checked." },
  independent: { label: "Independent finding", help: "From an auditor, IBAC, the Ombudsman, a regulator or a court." },
  author: { label: "My calculation", help: "My own arithmetic from published rates or data; the inputs are shown." },
} as const;

export type TagKind = keyof typeof tagKinds;

export interface ProjectJourneyDestination {
  title: string;
  href: `/projects/${string}`;
  description: string;
}

const projectJourney: Record<string, ProjectJourneyDestination> = {
  "/projects/communitilabs": {
    title: "Slipspire",
    href: "/projects/slipspire",
    description:
      "See how a creative reset became an original mobile ice-sliding puzzle game.",
  },
  "/projects/slipspire": {
    title: "Helping Group",
    href: "/projects/helping-group",
    description:
      "See how a bushfire-era service grew into practical community infrastructure.",
  },
  "/projects/helping-group": {
    title: "Guardian",
    href: "/projects/guardian",
    description:
      "See how local-first architecture protected sensitive location data during a crisis.",
  },
  "/projects/guardian": {
    title: "Land Index",
    href: "/projects/land-index",
    description:
      "See how open geospatial data made agricultural planning trade-offs inspectable.",
  },
  "/projects/land-index": {
    title: "Murray Grey Aus",
    href: "/projects/murray-grey-association-australia",
    description:
      "See how a fragile WordPress estate became a field-ready digital herd book.",
  },
  "/projects/murray-grey-association-australia": {
    title: "StudList",
    href: "/projects/studlist",
    description:
      "See how a free rural marketplace was shaped around industry-specific workflows.",
  },
  "/projects/studlist": {
    title: "Ferguson Livestock",
    href: "/projects/ferguson-livestock",
    description:
      "See how decision support, brand, commerce, and farm operations became one venture.",
  },
  "/projects/ferguson-livestock": {
    title: "AutoFarm",
    href: "/projects/autofarm",
    description:
      "See how manual work and earned automation shape a Rust farming game.",
  },
  "/projects/autofarm": {
    title: "SimpleXL",
    href: "/projects/simplexl",
    description:
      "See how a local-first desktop workbench makes spreadsheet data queryable with SQL.",
  },
  "/projects/simplexl": {
    title: "WaitAMinute",
    href: "/projects/waitaminute",
    description:
      "See how a browser extension creates a deliberate pause before distraction.",
  },
  "/projects/waitaminute": {
    title: "Mates Motivate",
    href: "/projects/mates-motivate",
    description:
      "See how social accountability became a focused behaviour-change MVP.",
  },
  "/projects/mates-motivate": {
    title: "yFocus",
    href: "/projects/yfocus",
    description:
      "See how an idea-validation concept earned the decision not to overbuild.",
  },
  "/projects/yfocus": {
    title: "TellTail",
    href: "/projects/telltail",
    description:
      "See how evidence and safety gates shape an early pet well-being product.",
  },
  "/projects/telltail": {
    title: "WP Flame",
    href: "/projects/wp-flame",
    description:
      "See how bounded traces turn WordPress performance into explainable evidence.",
  },
  "/projects/wp-flame": {
    title: "Airproxy",
    href: "/projects/airproxy",
    description:
      "See how edge infrastructure made Airtable safer to use in production.",
  },
  "/projects/airproxy": {
    title: "Observer",
    href: "/projects/observer",
    description:
      "See how monitoring closed the loop from service outage to recovery.",
  },
  "/projects/observer": {
    title: "Balance Board",
    href: "/projects/balance-board",
    description:
      "See how a Year 12 prototype joined physical design, analogue electronics, and software.",
  },
  "/projects/balance-board": {
    title: "Swin Lead",
    href: "/projects/swin-lead",
    description:
      "See how a student platform made leadership and collaboration visible.",
  },
  "/projects/swin-lead": {
    title: "Communiti Labs",
    href: "/projects/communitilabs",
    description:
      "See how community contributions become defensible evidence and better decisions.",
  },
};

const fallbackDestination: ProjectJourneyDestination = {
  title: "Communiti Labs",
  href: "/projects/communitilabs",
  description:
    "See how community contributions become defensible evidence and better decisions.",
};

export function getNextProject(
  canonicalUrl: string,
): ProjectJourneyDestination {
  return projectJourney[canonicalUrl.replace(/\/$/, "")] ?? fallbackDestination;
}

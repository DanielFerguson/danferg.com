export type SkillStatus = "Stable" | "Beta" | "Archived";

export interface PublishedSkill {
  slug: string;
  name: string;
  description: string;
  version: string;
  status: SkillStatus;
  skillCount: number;
  updatedDate: string;
}

const skills = [
  {
    slug: "chef",
    name: "Chef",
    description:
      "Conversational meal planning with transparent local Markdown memory, practical recipes, nutrition estimates, and controlled grocery preparation.",
    version: "0.2.0",
    status: "Stable",
    skillCount: 2,
    updatedDate: "2026-08-24",
  },
] satisfies PublishedSkill[];

export const publishedSkills = [...skills].sort((a, b) =>
  b.updatedDate.localeCompare(a.updatedDate),
);

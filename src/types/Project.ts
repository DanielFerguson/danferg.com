export default interface Project {
  title: string;
  description: string;
  tags: Array<string>;
  featured?: boolean;
  highlight?: boolean;
  period?: string;
  status?: string;
  role?: string;
  externalUrl?: string;
  externalLabel?: string;
  caseStudyLabel?: string;
  visualLabel?: string;
  imageKey: string;
  imageAlt?: string;
  canonicalUrl: string;
  externalLink?: string;
}

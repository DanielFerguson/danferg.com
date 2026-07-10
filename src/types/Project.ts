export default interface Project {
  title: string;
  iconUrl: string;
  description: string;
  tags: Array<string>;
  featured?: boolean;
  highlight?: boolean;
  period?: string;
  status?: string;
  role?: string;
  externalUrl?: string;
  externalLabel?: string;
  imageUrl: string;
  canonicalUrl: string;
  externalLink?: string;
}

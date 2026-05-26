export default interface Project {
  title: string;
  iconUrl: string;
  description: string;
  tags: Array<string>;
  featured?: boolean;
  externalUrl?: string;
  imageUrl: string;
  canonicalUrl: string;
  externalLink?: string;
}

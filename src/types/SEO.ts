interface OpenGraph {
  type: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export default interface SEO {
  title: string;
  headline?: string;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageType?: string;
  robots?: string;
  openGraph: OpenGraph;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  canonicalUrl: string;
  schemaType?: string;
  publishedDate?: string;
  modifiedDate?: string;
  articleSection?: string;
  citationUrls?: string[];
  mainEntityId?: string;
  breadcrumbs?: Array<BreadcrumbItem>;
}

interface OpenGraph {
  type: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export default interface SEO {
  title: string;
  description: string;
  imageUrl: string;
  openGraph: OpenGraph;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  canonicalUrl: string;
  schemaType?: string;
  publishedDate?: string;
  modifiedDate?: string;
  breadcrumbs?: Array<BreadcrumbItem>;
}

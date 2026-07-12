export interface EditorialUpdate {
  title: string;
  description: string;
  date: string;
  updatedDate?: string;
  canonicalUrl: string;
  imageUrl: string;
  category: string;
}

export const editorialUpdates: EditorialUpdate[] = [
  {
    title: "Hear every issue in every community voice",
    description:
      "A benchmark-backed product update on issue-level sentiment, multilingual feedback, and evidence traceability in Communiti Analysis.",
    date: "2026-06-10",
    updatedDate: "2026-07-12",
    canonicalUrl: "/2026-06-10-absa-announcement",
    imageUrl: "/images/og-default.png",
    category: "Product research",
  },
];

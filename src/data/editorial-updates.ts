export interface EditorialUpdate {
  title: string;
  description: string;
  date: string;
  updatedDate?: string;
  canonicalUrl: string;
  imageUrl: string;
  category: string;
}

export const editorialUpdates: EditorialUpdate[] = [];

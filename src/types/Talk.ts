import type { ImageMetadata } from "astro";

export default interface Talk {
  title: string;
  image: ImageMetadata;
  category: string;
  link: string;
  date: string;
  description: string;
  slidesUrl?: string;
}

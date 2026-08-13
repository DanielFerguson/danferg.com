export interface PodcastAppearance {
  kind: "podcast";
  title: string;
  show: string;
  date: string;
  description: string;
  spotifyUrl: string;
  spotifyId: string;
  contentNote?: string;
}

export interface TalkAppearance {
  kind: "talk";
  title: string;
  date: string;
  description: string;
  href: string;
  topic: string;
}

export type SpeakingAppearance = PodcastAppearance | TalkAppearance;

export const podcastAppearances: PodcastAppearance[] = [
  {
    kind: "podcast",
    title: "When Things Don't Go To Plan",
    show: "For the Love of Community Engagement",
    date: "2026-08-13",
    description:
      "An unguarded conversation with Becky Hirst about winding down Communiti Labs, whether engagement is consequential enough, accountability, regional councils, and where the sector needs to innovate next.",
    spotifyUrl:
      "https://open.spotify.com/episode/3TQ49YbWQSIGoyGtWWbVg2?si=0611168f8b754690",
    spotifyId: "3TQ49YbWQSIGoyGtWWbVg2",
    contentNote: "Spotify marks this episode as explicit.",
  },
  {
    kind: "podcast",
    title: "When Digital Fails",
    show: "For the Love of Community Engagement",
    date: "2026-07-26",
    description:
      "With Becky Hirst and Darius Turner, exploring digital-by-default engagement, face-to-face practice, what reach really means, AI benchmarking, and what comes after Communiti Labs.",
    spotifyUrl:
      "https://open.spotify.com/episode/2KiENEl8TddqQG35HjRbuI?si=1931dfdc36064676",
    spotifyId: "2KiENEl8TddqQG35HjRbuI",
    contentNote:
      "Brief reference to suicide around the 40-minute mark, during a discussion of gun culture and safety.",
  },
  {
    kind: "podcast",
    title: "Artificial Intelligence (AI) In The Room",
    show: "For the Love of Community Engagement",
    date: "2026-06-24",
    description:
      "A conversation with Becky Hirst and Lisa Ippolito about responsible AI in local government, capability building, synthetic audiences, authentication, and using technology to make engagement more human.",
    spotifyUrl:
      "https://open.spotify.com/episode/1imhJyvR4MP5xpTbZbDage?si=0b4f2ca3521342ff",
    spotifyId: "1imhJyvR4MP5xpTbZbDage",
  },
  {
    kind: "podcast",
    title: "Has Community Engagement Stopped Being Bold?",
    show: "For the Love of Community Engagement",
    date: "2026-05-31",
    description:
      "Becky Hirst, Mel Hagedorn and I ask whether community engagement has lost its boldness—and what it would take to move beyond surveys, data collection, and engagement theatre.",
    spotifyUrl:
      "https://open.spotify.com/episode/6eafw9nAQEj3K2oWslj9Kb?si=3ba49661f2d146d2",
    spotifyId: "6eafw9nAQEj3K2oWslj9Kb",
  },
];

export const selectedTalks: TalkAppearance[] = [
  {
    kind: "talk",
    title: "Building a business in an hour... with no code!",
    description:
      "A practical walkthrough of using no-code tools to build a digital-facing business quickly.",
    href: "/assets/slides/no-code-w-notes.pdf",
    date: "2022-08-18",
    topic: "Entrepreneurship",
  },
  {
    kind: "talk",
    title: "Concept to Production",
    description:
      "The five steps I use to take startup ideas from a rough concept to a product people can use.",
    href: "https://www.youtube.com/watch?v=_SZP7QmIIfE",
    date: "2022-05-03",
    topic: "Entrepreneurship",
  },
  {
    kind: "talk",
    title: "SwinLead Leadership Workshop",
    description:
      "An honest discussion about the experiences, challenges, and successes of leading student communities.",
    href: "https://www.youtube.com/watch?v=7_aJAvfGNsY",
    date: "2022-04-13",
    topic: "Leadership",
  },
];

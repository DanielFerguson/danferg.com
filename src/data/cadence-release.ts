export interface SpeechEngineSpec {
  name: string;
  badge?: string;
  download: string;
  latency: string;
  hardware: string;
  highlights: string;
}

export interface ShortcutItem {
  keys: string[];
  action: string;
}

export interface ShortcutGroup {
  title: string;
  note: string;
  items: ShortcutItem[];
}

export interface SyntaxTip {
  token: string;
  previewKind: "heading" | "cue" | "emphasis" | "import";
  previewLabel: string;
  description: string;
}

export interface StorageLocation {
  label: string;
  path: string;
  detail: string;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  dateLabel: string;
  summary: string;
  items: Array<{
    title: string;
    detail: string;
  }>;
}

export const cadenceRelease = {
  name: "Cadence",
  version: "1.0.0",
  build: "1",
  releaseDate: "2026-11-27",
  releaseDateLabel: "27 November 2026",
  downloadUrl: "/downloads/Cadence-1.0.0-arm64.dmg",
  downloadFileName: "Cadence-1.0.0-arm64.dmg",
  downloadSize: "18.6 MB",
  downloadBytes: 18_646_764,
  sha256: "30f266f2e7fd8914bb387bea7e429fb74c3cc1980eb37aeae5ea812de4057550",
  quarantineCommand: "xattr -cr /Applications/Cadence.app",
  checksumCommand: "shasum -a 256 ~/Downloads/Cadence-1.0.0-arm64.dmg",
  architecture: "Apple Silicon (arm64)",
  macosRequirement: "macOS 26.0 (Tahoe) or later",
  price: "Free",
  signingStatus: "Ad-hoc signed",
  networkModel: "100% offline, zero cloud APIs",
} as const;

export const cadenceAtAGlance = [
  {
    value: "0 MB",
    title: "Ready out of the box",
    detail: "Runs on Apple's built-in on-device SpeechAnalyzer with no initial model download.",
  },
  {
    value: "~100 ms",
    title: "Streaming floor",
    detail: "Down to roughly 100 ms word-by-word latency with optional Moonshine v2 Tiny.",
  },
  {
    value: "120 Hz",
    title: "Critically damped scroll",
    detail: "Smoothly matches your pace and holds still whenever you pause or ad-lib.",
  },
  {
    value: "0",
    title: "Bytes sent to the cloud",
    detail: "No accounts, no telemetry, and passive read-only microphone capture.",
  },
];

export const speechEngines: SpeechEngineSpec[] = [
  {
    name: "Apple On-Device Speech",
    badge: "Default",
    download: "0 MB (built-in)",
    latency: "~125–200 ms",
    hardware: "Apple Neural Engine",
    highlights: "Ready straight away via macOS SpeechAnalyzer with zero setup.",
  },
  {
    name: "Apple On-Device (Script Bias)",
    download: "0 MB (built-in)",
    latency: "~150–220 ms",
    hardware: "Apple Neural Engine",
    highlights: "Biases recognition towards names, acronyms, and terms already in your script.",
  },
  {
    name: "Moonshine v2 Tiny (34M)",
    download: "~35 MB",
    latency: "~100 ms",
    hardware: "CPU Streaming",
    highlights: "Fastest word-by-word feel; supports live script keyterm biasing.",
  },
  {
    name: "Moonshine v2 Small (123M)",
    download: "~100 MB",
    latency: "~125 ms",
    hardware: "CPU Streaming",
    highlights: "Stronger accuracy on technical vocabulary and proper nouns, with script biasing.",
  },
  {
    name: "Parakeet Realtime EOU (120M)",
    download: "~200 MB",
    latency: "~160 ms",
    hardware: "CoreML Neural Engine",
    highlights: "NVIDIA streaming transducer via FluidAudio; keeps CPU usage very low.",
  },
  {
    name: "Live Rehearsal Simulator",
    download: "0 MB (built-in)",
    latency: "Instant",
    hardware: "Local timer",
    highlights: "Variable-speed simulated voice for rehearsing layout and pacing without a mic.",
  },
];

export const formattingTips: SyntaxTip[] = [
  {
    token: "# Section Title",
    previewKind: "heading",
    previewLabel: "HOW VOICE FOLLOW WORKS",
    description:
      "Creates a jumpable cue marker in the notch header (for example Cue 2/3) so you can hop between sections mid-take.",
  },
  {
    token: "[pause] [smile] [breathe]",
    previewKind: "cue",
    previewLabel: "pause",
    description:
      "Renders as an amber stage-cue pill in both the editor and the notch, and is skipped by the voice aligner so it never stalls tracking.",
  },
  {
    token: "**emphasised phrase**",
    previewKind: "emphasis",
    previewLabel: "Cadence",
    description:
      "Highlights key words visually inside the prompter so vocal stress lands where you planned it.",
  },
  {
    token: ".txt · .md · .rtf",
    previewKind: "import",
    previewLabel: "UTF-8 Markdown mirror",
    description:
      "Import existing scripts directly into your library. Every script mirrors automatically to plain UTF-8 Markdown on disk.",
  },
];

export const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Workspace",
    note: "Editing and organising scripts",
    items: [
      { keys: ["⌘", "↩"], action: "Launch prompter from top" },
      { keys: ["⇧", "⌘", "↩"], action: "Launch prompter from cursor" },
      { keys: ["⌘", "N"], action: "New script" },
      { keys: ["⇧", "⌘", "N"], action: "New folder" },
      { keys: ["⇧", "⌘", "P"], action: "Pin or unpin script" },
      { keys: ["⌘", "⌫"], action: "Move script to Recently Deleted" },
      { keys: ["⇧", "⌘", "M"], action: "Insert # Section heading" },
      { keys: ["⇧", "⌘", "D"], action: "Insert [pause] stage cue" },
      { keys: ["⌘", ","], action: "Open Settings" },
    ],
  },
  {
    title: "Prompter & global controls",
    note: "Active while prompting or across macOS",
    items: [
      { keys: ["Space"], action: "Play, pause, or skip countdown" },
      { keys: ["V"], action: "Toggle Voice Follow and Auto-Scroll" },
      { keys: ["R"], action: "Restart script from top" },
      { keys: ["M"], action: "Collapse to or expand from tucked notch pill" },
      { keys: ["Esc"], action: "Dismiss prompter overlay" },
      { keys: ["⌥", "Space"], action: "Global show or hide prompter" },
      { keys: ["⌥", "⇧", "P"], action: "Global play or pause" },
      { keys: ["⌥", "⇧", "↑", "/", "↓"], action: "Global previous or next section cue" },
    ],
  },
];

export const storageLocations: StorageLocation[] = [
  {
    label: "Library & settings",
    path: "~/Library/Application Support/Cadence/library.json",
    detail: "Folders, pinned flags, preferences, and metadata.",
  },
  {
    label: "Plain Markdown mirrors",
    path: "~/Library/Application Support/Cadence/Scripts/*.md",
    detail: "Human-readable UTF-8 copies of every script you write.",
  },
  {
    label: "Optional speech models",
    path: "~/Library/Application Support/Cadence/Models/",
    detail: "Downloaded Moonshine v2 and Parakeet weights, kept offline.",
  },
];

export const changelogReleases: ChangelogRelease[] = [
  {
    version: "1.0.0",
    date: "2026-11-27",
    dateLabel: "27 November 2026",
    summary: "First public Apple Silicon release for macOS 26 (Tahoe) and later.",
    items: [
      {
        title: "MacBook notch Live Activity prompter",
        detail:
          "Non-activating floating panel fused to the camera notch with spring transitions, tucked pill mode, 3-second countdown ring, live 5-band audio beam, symmetrical bottom-corner resize, hover controls dock, and a detached floating window for external displays.",
      },
      {
        title: "Apple Notes-inspired 3-column script workspace",
        detail:
          "Folders, pinned scripts, instant search, distraction-free editor with # Section cue headings, amber [stage cue] pills, live word-count and duration estimates, .txt/.md/.rtf import, and plain UTF-8 Markdown mirrors on disk.",
      },
      {
        title: "Real-time on-device voice following",
        detail:
          "Three-tier phonetic and bounded dynamic-programming aligner (Double Metaphone plus fuzzy matching) driving critically damped 120 Hz scroll physics, alongside Classic Auto-Scroll (75–240 WPM).",
      },
      {
        title: "Five local speech engines plus rehearsal simulator",
        detail:
          "Built-in Apple SpeechAnalyzer (standard and script-biased), in-app one-click downloads for Moonshine v2 Tiny (34M), Moonshine v2 Small (123M), and NVIDIA Parakeet Realtime EOU (120M) via FluidAudio, plus a mic-free Live Rehearsal Simulator.",
      },
      {
        title: "Screen-share privacy and passive audio tap",
        detail:
          "Default NSWindow.sharingType = .none exclusion for screenshots and legacy capture, paired with a passive read-only AVAudioEngine mic tap that leaves Zoom, Loom, Screen Studio, OBS, and AirPods routing untouched.",
      },
    ],
  },
];

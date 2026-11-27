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

export interface MCPTransportSpec {
  name: string;
  endpoint: string;
  scope: string;
  detail: string;
}

export interface MCPCapabilitySpec {
  label: string;
  title: string;
  detail: string;
}

export interface MCPClientGroup {
  method: string;
  clients: string[];
  note: string;
}

export const cadenceRelease = {
  name: "Cadence",
  version: "1.1.2",
  build: "4",
  releaseDate: "2026-11-27",
  releaseDateLabel: "27 November 2026",
  downloadUrl: "/downloads/Cadence-1.1.2-arm64.dmg",
  downloadFileName: "Cadence-1.1.2-arm64.dmg",
  downloadSize: "19.7 MB",
  downloadBytes: 19_711_726,
  sha256: "3e62387cdf3b5a88c15d80cee3e0b263a5dd8531e1691415bb6447184214fc4b",
  quarantineCommand: "xattr -cr /Applications/Cadence.app",
  checksumCommand: "shasum -a 256 ~/Downloads/Cadence-1.1.2-arm64.dmg",
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
  {
    label: "MCP activity & AI undo snapshots",
    path: "~/Library/Application Support/Cadence/mcp-activity.json · mcp-snapshots.json",
    detail: "Local client handshake log and the last 20 pre-AI-edit script revisions.",
  },
];

export const mcpTransports: MCPTransportSpec[] = [
  {
    name: "Bundled stdio helper",
    endpoint: "~/.local/bin/cadence-mcp",
    scope: "Works even when Cadence is closed",
    detail:
      "Native Swift executable bundled inside Cadence.app and symlinked to a stable path, sharing the library through POSIX file locks.",
  },
  {
    name: "Localhost Streamable HTTP",
    endpoint: "http://127.0.0.1:48621/mcp",
    scope: "In-app loopback server (on by default)",
    detail:
      "Strict 127.0.0.1 loopback binding with Origin validation for desktop and HTTP-native MCP clients.",
  },
];

export const mcpCapabilities: MCPCapabilitySpec[] = [
  {
    label: "17 tools + resources + prompts",
    title: "Full script & folder control",
    detail:
      "Create, read, search, organise, and make surgical edits (edit_script replace, append, or section updates), run analyze_script for pacing and cue metrics, or call open_script to select a script in the workspace without ever triggering the notch overlay.",
  },
  {
    label: "Soft-delete & live sync",
    title: "Built not to wreck an active take",
    detail:
      "Atomic flock-coordinated writes reload live into the open editor, while any active teleprompter session freezes safely mid-read. Deletions move scripts to Recently Deleted only.",
  },
  {
    label: "20-revision safety net",
    title: "Pre-AI snapshots with 1-click Revert",
    detail:
      "Every AI mutation captures the prior document first (keeping the last 20 snapshots locally) alongside a recent AI activity strip so you can undo any edit in one click.",
  },
  {
    label: "Verification & native UI",
    title: "Three-layer connection checks",
    detail:
      "Configure and verify from Settings (⌘,) → AI & MCP, the workspace toolbar Connect AI sheet, or a dismissible sidebar prompt, tracking config status, live server self-tests, and real client handshakes.",
  },
];

export const mcpClientGroups: MCPClientGroup[] = [
  {
    method: "Native deeplink",
    clients: ["Cursor", "VS Code"],
    note: "Opens the client's built-in MCP install prompt directly via cursor:// and vscode:mcp/install.",
  },
  {
    method: "1-click backed-up config",
    clients: [
      "Claude Desktop (.mcpb)",
      "Claude Code",
      "Gemini CLI",
      "Google Antigravity",
      "OpenAI Codex",
    ],
    note: "Safely installs or removes Cadence with an automatic config backup first.",
  },
  {
    method: "Copy JSON / URL",
    clients: ["ChatGPT Desktop", "Custom MCP clients"],
    note: "Guided snippet cards plus a Copy Test Prompt button to verify the live handshake.",
  },
];

export const changelogReleases: ChangelogRelease[] = [
  {
    version: "1.1.2",
    date: "2026-11-27",
    dateLabel: "27 November 2026",
    summary:
      "Enforces a single workspace window across macOS app launches and menu bar actions.",
    items: [
      {
        title: "Single-window workspace enforcement",
        detail:
          "Switched the workspace scene from WindowGroup to macOS's single-instance Window, updated menu bar actions (Open Workspace and Connect AI) to focus the existing window, and added a launch guard so duplicate workspace windows never spawn.",
      },
    ],
  },
  {
    version: "1.1.1",
    date: "2026-11-27",
    dateLabel: "27 November 2026",
    summary:
      "Fixes a Swift 6 directory-watcher isolation crash and a macOS 26 workspace header alignment regression introduced in v1.1.0.",
    items: [
      {
        title: "Swift 6 directory watcher isolation fix",
        detail:
          "Moved MCPIntegrationController's filesystem DispatchSource onto DispatchQueue.main so live library change events never fire @MainActor-isolated handlers from a background queue.",
      },
      {
        title: "Workspace header & column alignment on macOS 26",
        detail:
          "Fixed a SwiftUI NavigationSplitView layout bug where the sidebar MCP prompt card inflated the split view and pushed all three column headers underneath the toolbar and window controls.",
      },
      {
        title: "Connect AI sheet modifier ordering",
        detail:
          "Moved the Connect AI sheet presentation to the end of WorkspaceRootView's modifier chain so split-view styling and toolbar modifiers attach directly to NavigationSplitView.",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-11-27",
    dateLabel: "27 November 2026",
    summary:
      "Adds local-first Cadence MCP server support, one-click AI client setup, live editor sync, and 20-revision pre-AI undo snapshots.",
    items: [
      {
        title: "Local-first Cadence MCP server (stdio + Streamable HTTP)",
        detail:
          "Bundled native Swift cadence-mcp stdio helper (symlinked to ~/.local/bin/cadence-mcp so it works even when Cadence is closed) plus a loopback-only in-app HTTP server at 127.0.0.1:48621/mcp with Host and Origin validation.",
      },
      {
        title: "17 script & folder tools, MCP resources, and authoring prompts",
        detail:
          "Full script and folder CRUD, surgical edit_script modes (replace_text, append_text, prepend_text, replace_section), analyze_script metrics, open_script workspace selection, library resources, and write_teleprompter_script / polish_for_delivery prompts.",
      },
      {
        title: "One-click AI provider setup and 3-layer verification UI",
        detail:
          "New Settings (⌘,) → AI & MCP tab, workspace toolbar Connect AI sheet, and dismissible sidebar prompt supporting Cursor, VS Code, Claude Desktop (.mcpb), Claude Code, Gemini CLI, Google Antigravity, OpenAI Codex, and ChatGPT Desktop.",
      },
      {
        title: "Live sync, soft-delete guardrail, and 20-revision AI undo",
        detail:
          "POSIX flock-coordinated writes reload live into the editor without disrupting an active notch prompter session, deletions move to Recently Deleted only, and pre-edit snapshots enable one-click Revert.",
      },
    ],
  },
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

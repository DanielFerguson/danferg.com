export interface IOSStudioSpecGroup {
  label: string;
  title: string;
  items: string[];
}

export interface IOSSyncChannel {
  name: string;
  transport: string;
  availability: string;
  detail: string;
}

export interface IOSDemoMoment {
  id: "studio" | "outdoors" | "landscape";
  label: string;
  caption: string;
  orientation: "portrait" | "landscape";
  darkInk: boolean;
}

export interface IOSDemoToken {
  text: string;
  kind: "word" | "cue";
  sentenceStart?: boolean;
  cueTitle?: string;
}

export const cadenceIOSMoments: IOSDemoMoment[] = [
  {
    id: "studio",
    label: "Studio",
    caption:
      "Pure Lens mode hides the chrome while you roll. Tap the shutter to pause, or swipe right on the script to rewind.",
    orientation: "portrait",
    darkInk: false,
  },
  {
    id: "outdoors",
    label: "Outdoors",
    caption:
      "Smart Contrast samples the bright sky behind the card and flips automatically to dark charcoal ink.",
    orientation: "portrait",
    darkInk: true,
  },
  {
    id: "landscape",
    label: "Landscape",
    caption:
      "Rotate your iPhone and the script hugs the camera lens while controls shift to the opposite Pro Rail.",
    orientation: "landscape",
    darkInk: false,
  },
];

export const cadenceIOSDemoScript: IOSDemoToken[] = [
  { text: "Step", kind: "word", sentenceStart: true, cueTitle: "1 · Eye line" },
  { text: "away", kind: "word" },
  { text: "from", kind: "word" },
  { text: "your", kind: "word" },
  { text: "desk", kind: "word" },
  { text: "and", kind: "word" },
  { text: "the", kind: "word" },
  { text: "script", kind: "word" },
  { text: "hugs", kind: "word" },
  { text: "the", kind: "word" },
  { text: "iPhone", kind: "word" },
  { text: "lens.", kind: "word" },
  { text: "pause", kind: "cue" },
  { text: "Speak", kind: "word", sentenceStart: true, cueTitle: "1 · Eye line" },
  { text: "faster", kind: "word" },
  { text: "or", kind: "word" },
  { text: "stop", kind: "word" },
  { text: "to", kind: "word" },
  { text: "improvise,", kind: "word" },
  { text: "and", kind: "word" },
  { text: "on-device", kind: "word" },
  { text: "speech", kind: "word" },
  { text: "tracking", kind: "word" },
  { text: "waits", kind: "word" },
  { text: "for", kind: "word" },
  { text: "you.", kind: "word" },
  { text: "smile", kind: "cue" },
  { text: "If", kind: "word", sentenceStart: true, cueTitle: "2 · Mid-take recovery" },
  { text: "you", kind: "word" },
  { text: "flub", kind: "word" },
  { text: "a", kind: "word" },
  { text: "line,", kind: "word" },
  { text: "swipe", kind: "word" },
  { text: "right", kind: "word" },
  { text: "to", kind: "word" },
  { text: "rewind", kind: "word" },
  { text: "one", kind: "word" },
  { text: "sentence", kind: "word" },
  { text: "and", kind: "word" },
  { text: "drop", kind: "word" },
  { text: "a", kind: "word" },
  { text: "chapter", kind: "word" },
  { text: "marker.", kind: "word" },
];

export const cadenceIOSAtAGlance = [
  {
    value: "4K 60",
    title: "Creator Pro capture",
    detail: "1080p or 4K at 24/25/30/50/60 fps in HEVC or H.264, plus 10-bit HDR and QuickTime chapter markers.",
  },
  {
    value: "16×8",
    title: "Smart Contrast grid",
    detail: "Live Y-plane luminance sampling behind the text card with 0.62 / 0.44 hysteresis and zero flicker.",
  },
  {
    value: "1",
    title: "Shared audio pipeline",
    detail: "One AVCaptureAudioDataOutput feeds both AVAssetWriter and on-device speech recognition without contention.",
  },
  {
    value: "0 Hz",
    title: "Idle display link",
    detail: "UIKit TextKit 1 canvas driven by CADisplayLink that sleeps completely whenever you pause talking.",
  },
];

export const cadenceIOSStudioGroups: IOSStudioSpecGroup[] = [
  {
    label: "Prompter & eye line",
    title: "Anchored directly under the lens",
    items: [
      "78% narrow default column centred right beneath the Dynamic Island or notch in portrait",
      "Automatic landscape flip: text hugs the camera edge while controls move to an opposite Pro Rail",
      "Pure Lens recording mode: collapses footer into a 3 pt hairline progress bar with a crimson tally glow",
      "Swipe right across the script to rewind to the start of the previous sentence and drop a retake chapter",
    ],
  },
  {
    label: "Smart Contrast",
    title: "Readable against shifting backgrounds",
    items: [
      "Samples a 16×8 grid directly from the camera CVPixelBuffer Y-plane (8-bit SDR or 10-bit HLG HDR)",
      "Dual-threshold hysteresis (0.62 to dark ink, 0.44 to light ink) with 2-sample confirmation",
      "Automatic protective scrim kicks in only on busy or mid-grey scenes when manual opacity is low",
      "Zero GPU or Metal allocations on the camera video queue",
    ],
  },
  {
    label: "Camera & audio",
    title: "Built like a dedicated video tool",
    items: [
      "25 fps and 50 fps presets alongside 24/30/60 fps to prevent 50 Hz indoor lighting flicker in Australia",
      "Tap-to-focus, long-press AE/AF lock, manual EV bias (-2.0 to +2.0 EV), and manual Kelvin (2500–8500K) + tint",
      "Multi-cam 0.5× / 1× / 2× quick zoom pills, Standard/Cinematic stabilisation, and volume/Bluetooth shutter",
      "Front/rear directional cardioid mic beamforming matched to the active lens, plus live clipping LED",
    ],
  },
  {
    label: "Takes & post-production",
    title: "Safe footage and faster edits",
    items: [
      "Auto-saves finished takes into a dedicated Cadence album in Apple Photos so footage survives sideload expiry",
      "Crash-safe PendingTakes recovery catches interrupted recordings on relaunch",
      "Automatic QuickTime timed chapter markers (.mov) generated from # Section cues for FCP, Resolve, and Premiere",
      "Post-take review bar with 1-tap AirDrop/Share and Delete & Retake from the top or current cue",
    ],
  },
];

export const cadenceIOSSyncChannels: IOSSyncChannel[] = [
  {
    name: "Local Wi-Fi Sync (Bonjour)",
    transport: "_cadence-sync._tcp · 6-digit single-use pairing code",
    availability: "Works offline on any build, including ad-hoc Mac DMG",
    detail:
      "Discovers Cadence on your Mac over local Wi-Fi, pairs with a 2-minute code (rate-limited after 5 failed tries), and merges scripts, folders, and 30-day deletion tombstones deterministically.",
  },
  {
    name: "iCloud CloudKit Sync",
    transport: "Private database · CadenceLibraryZone (CKServerChangeToken)",
    availability: "Provisioned Apple Developer / TestFlight builds",
    detail:
      "Incremental two-way background sync across Wi-Fi and cellular, including scripts drafted via MCP on Mac. Safely self-disables if a personal sideload lacks CloudKit entitlements.",
  },
];

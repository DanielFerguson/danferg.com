import airproxyScreenshot from "../assets/projects/airproxy/screenshot.webp";
import autofarmScreenshot from "../assets/projects/autofarm/screenshot.webp";
import balanceBoardScreenshot from "../assets/projects/balance-board/screenshot.webp";
import communitiLabsScreenshot from "../assets/projects/communitilabs/screenshot.png";
import fergusonLivestockScreenshot from "../assets/projects/ferguson-livestock/screenshot.webp";
import guardianScreenshot from "../assets/projects/guardian/screenshot.webp";
import helpingGroupScreenshot from "../assets/projects/helping-group/screenshot.webp";
import landIndexScreenshot from "../assets/projects/land-index/screenshot.webp";
import matesMotivateScreenshot from "../assets/projects/mates-motivate/screenshot.webp";
import murrayGreyAssociationAustraliaScreenshot from "../assets/projects/murray-grey-association-australia/screenshot.webp";
import observerScreenshot from "../assets/projects/observer/screenshot.webp";
import studListScreenshot from "../assets/projects/studlist/screenshot.webp";
import swinLeadScreenshot from "../assets/projects/swin-lead/screenshot.webp";
import tellTailScreenshot from "../assets/projects/telltail/screenshot.webp";
import waitAMinuteScreenshot from "../assets/projects/waitaminute/screenshot.webp";
import wpFlameScreenshot from "../assets/projects/wp-flame/screenshot.webp";
import yfocusScreenshot from "../assets/projects/yfocus/screenshot.webp";

export const projectScreenshots = {
  airproxy: airproxyScreenshot,
  autofarm: autofarmScreenshot,
  "balance-board": balanceBoardScreenshot,
  communitilabs: communitiLabsScreenshot,
  "ferguson-livestock": fergusonLivestockScreenshot,
  guardian: guardianScreenshot,
  "helping-group": helpingGroupScreenshot,
  "land-index": landIndexScreenshot,
  "mates-motivate": matesMotivateScreenshot,
  "murray-grey-association-australia": murrayGreyAssociationAustraliaScreenshot,
  observer: observerScreenshot,
  studlist: studListScreenshot,
  "swin-lead": swinLeadScreenshot,
  telltail: tellTailScreenshot,
  waitaminute: waitAMinuteScreenshot,
  "wp-flame": wpFlameScreenshot,
  yfocus: yfocusScreenshot,
};

export function getProjectScreenshot(key: string) {
  const screenshot = projectScreenshots[key as keyof typeof projectScreenshots];
  if (!screenshot) throw new Error(`Unknown project screenshot key: ${key}`);
  return screenshot;
}

export function getProjectExternalUrl(project: {
  externalLink?: string;
  externalUrl?: string;
}) {
  return project.externalLink || project.externalUrl || "";
}

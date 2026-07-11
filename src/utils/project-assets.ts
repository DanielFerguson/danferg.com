import airproxyScreenshot from "../assets/projects/airproxy/screenshot.webp";
import autofarmScreenshot from "../assets/projects/autofarm/screenshot.webp";
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
  "/assets/projects/airproxy/screenshot.webp": airproxyScreenshot,
  "/assets/projects/autofarm/screenshot.webp": autofarmScreenshot,
  "/assets/projects/communitilabs/screenshot.png": communitiLabsScreenshot,
  "/assets/projects/ferguson-livestock/screenshot.webp":
    fergusonLivestockScreenshot,
  "/assets/projects/guardian/screenshot.webp": guardianScreenshot,
  "/assets/projects/helping-group/screenshot.webp": helpingGroupScreenshot,
  "/assets/projects/land-index/screenshot.webp": landIndexScreenshot,
  "/assets/projects/mates-motivate/screenshot.webp": matesMotivateScreenshot,
  "/assets/projects/murray-grey-association-australia/screenshot.webp":
    murrayGreyAssociationAustraliaScreenshot,
  "/assets/projects/observer/screenshot.webp": observerScreenshot,
  "/assets/projects/studlist/screenshot.webp": studListScreenshot,
  "/assets/projects/swin-lead/screenshot.webp": swinLeadScreenshot,
  "/assets/projects/telltail/screenshot.webp": tellTailScreenshot,
  "/assets/projects/waitaminute/screenshot.webp": waitAMinuteScreenshot,
  "/assets/projects/wp-flame/screenshot.webp": wpFlameScreenshot,
  "/assets/projects/yfocus/screenshot.webp": yfocusScreenshot,
};

export function getProjectScreenshot(path: string) {
  return projectScreenshots[path as keyof typeof projectScreenshots] ?? path;
}

export function getProjectExternalUrl(project: {
  externalLink?: string;
  externalUrl?: string;
}) {
  return project.externalLink || project.externalUrl || "";
}

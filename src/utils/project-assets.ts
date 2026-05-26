import airproxyScreenshot from "../assets/projects/airproxy/screenshot.webp";
import guardianScreenshot from "../assets/projects/guardian/screenshot.webp";
import helpingGroupScreenshot from "../assets/projects/helping-group/screenshot.webp";
import landIndexScreenshot from "../assets/projects/land-index/screenshot.webp";
import matesMotivateScreenshot from "../assets/projects/mates-motivate/screenshot.webp";
import observerScreenshot from "../assets/projects/observer/screenshot.webp";
import swinLeadScreenshot from "../assets/projects/swin-lead/screenshot.webp";
import yfocusScreenshot from "../assets/projects/yfocus/screenshot.webp";

export const projectScreenshots = {
  "/assets/projects/airproxy/screenshot.webp": airproxyScreenshot,
  "/assets/projects/guardian/screenshot.webp": guardianScreenshot,
  "/assets/projects/helping-group/screenshot.webp": helpingGroupScreenshot,
  "/assets/projects/land-index/screenshot.webp": landIndexScreenshot,
  "/assets/projects/mates-motivate/screenshot.webp": matesMotivateScreenshot,
  "/assets/projects/observer/screenshot.webp": observerScreenshot,
  "/assets/projects/swin-lead/screenshot.webp": swinLeadScreenshot,
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

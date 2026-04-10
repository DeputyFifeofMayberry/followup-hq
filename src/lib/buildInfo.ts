import { rawBuildMeta } from '../generated/buildMeta';

export type BuildEnvironment = 'production' | 'preview' | 'local';

export type BuildInfo = {
  version: string;
  commitSha: string | null;
  shortSha: string;
  buildTimestamp: string;
  buildTimestampLabel: string;
  branch: string;
  environment: BuildEnvironment;
  prNumber: number | null;
  prTitle: string | null;
  deploymentUrl: string | null;
  hasPrMetadata: boolean;
};

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export function getBuildInfo(): BuildInfo {
  const environment = rawBuildMeta.environment ?? 'local';
  return {
    version: rawBuildMeta.version,
    commitSha: rawBuildMeta.commitSha,
    shortSha: rawBuildMeta.shortSha ?? 'unknown',
    buildTimestamp: rawBuildMeta.buildTimestamp,
    buildTimestampLabel: formatTimestamp(rawBuildMeta.buildTimestamp),
    branch: rawBuildMeta.branch ?? 'unknown',
    environment,
    prNumber: rawBuildMeta.prNumber,
    prTitle: rawBuildMeta.prTitle,
    deploymentUrl: rawBuildMeta.deploymentUrl,
    hasPrMetadata: rawBuildMeta.prNumber !== null,
  };
}

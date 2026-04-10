import { useMemo } from 'react';
import { getBuildInfo } from '../../lib/buildInfo';

export function BuildStamp() {
  const buildInfo = useMemo(() => getBuildInfo(), []);

  return (
    <details className="build-stamp" title={`Build ${buildInfo.version} (${buildInfo.shortSha})`}>
      <summary className="build-stamp-summary">
        <span className="build-stamp-line">v{buildInfo.version}</span>
        <span className="build-stamp-line">{buildInfo.prNumber ? `PR #${buildInfo.prNumber}` : 'No PR'}</span>
        <span className="build-stamp-line build-stamp-sha">{buildInfo.shortSha}</span>
      </summary>

      <div className="build-stamp-detail" role="note" aria-label="Build metadata details">
        <dl>
          <div>
            <dt>Version</dt>
            <dd>v{buildInfo.version}</dd>
          </div>
          <div>
            <dt>PR</dt>
            <dd>
              {buildInfo.prNumber ? `#${buildInfo.prNumber}` : 'PR unavailable'}
              {buildInfo.prTitle ? <span className="build-stamp-pr-title"> — {buildInfo.prTitle}</span> : null}
            </dd>
          </div>
          <div>
            <dt>Commit</dt>
            <dd>{buildInfo.shortSha}</dd>
          </div>
          <div>
            <dt>Full SHA</dt>
            <dd className="build-stamp-break">{buildInfo.commitSha ?? 'Unavailable'}</dd>
          </div>
          <div>
            <dt>Built at</dt>
            <dd>{buildInfo.buildTimestampLabel}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{buildInfo.branch}</dd>
          </div>
          <div>
            <dt>Env</dt>
            <dd>{buildInfo.environment}</dd>
          </div>
          <div>
            <dt>Deploy URL</dt>
            <dd className="build-stamp-break">
              {buildInfo.deploymentUrl ? (
                <a href={buildInfo.deploymentUrl} target="_blank" rel="noreferrer">
                  {buildInfo.deploymentUrl}
                </a>
              ) : (
                'Unavailable'
              )}
            </dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

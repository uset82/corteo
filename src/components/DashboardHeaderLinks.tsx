import type { CSSProperties } from 'react';
import { useT } from '../i18n/locale';
import { theme } from '../theme';
import { Icon } from './icons';

// The AGPL's source offer (BQ-2): this fork's repository, and nothing else. The
// upstream author's contact popover and email are gone; the upstream credits and
// the licence notices stay wherever they are a credit.
const PROJECT_REPOSITORY_URL = 'https://github.com/uset82/corteo';

export function DashboardHeaderLinks() {
  const t = useT();
  return (
    <a
      href={PROJECT_REPOSITORY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('源代码 (AGPL)')}
      data-tip={t('源代码 (AGPL)')}
      data-cc-titlebar-control="true"
      className="cc-header-btn cc-tip cc-tip-r"
      style={githubLink}
    >
      <Icon name="github" size={16} />
    </a>
  );
}

const githubLink: CSSProperties = {
  background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', padding: 6,
  borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  textDecoration: 'none',
};

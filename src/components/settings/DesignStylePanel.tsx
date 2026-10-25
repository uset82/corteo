import { getLocale } from '../../i18n/locale';
import type { DesignStyle } from '../../editor/types';
import {
  DesignStylePanelBody,
  DesignStylePanelFooter,
  DesignStylePanelFrame,
  DesignStylePanelHeader,
} from './DesignStylePanelSections';
import { useDesignStylePanelModel } from './useDesignStylePanelModel';
import { BrandKitSection } from '../brand/BrandKitSection';
import type { BrandKit } from '../../brand/kit';

interface DesignStylePanelProps {
  style: DesignStyle | undefined;
  onApply: (style: DesignStyle | null) => void;
  onClose: () => void;
  /** Plan 5 brand kit and its commit path; absent = the section is not rendered. */
  brandKit?: BrandKit;
  onSaveBrandKit?: (kit: BrandKit) => void;
}

/** Design-style editor with a live draft preview and one-shot project apply. */
export function DesignStylePanel({ style, onApply, onClose, brandKit, onSaveBrandKit }: DesignStylePanelProps) {
  const locale = getLocale();
  const model = useDesignStylePanelModel(style);
  return <DesignStylePanelFrame onClose={onClose}>
    <DesignStylePanelHeader primary={model.preview.primary} onClose={onClose} />
    <DesignStylePanelBody model={model} locale={locale} />
    {brandKit && onSaveBrandKit && <BrandKitSection kit={brandKit} onSave={onSaveBrandKit} />}
    <DesignStylePanelFooter model={model} onApply={onApply} onClose={onClose} />
  </DesignStylePanelFrame>;
}

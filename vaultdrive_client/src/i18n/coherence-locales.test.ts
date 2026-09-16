import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import en from '../locales/en/drive.json';
import es from '../locales/es/drive.json';

function leaves(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
}
const audited = ['coherence', 'transfers', 'recovery', 'firstTask'];
describe('critical journey translations', () => {
  it('ships every new journey key in both supported languages', () => {
    const english = leaves(en).filter(key => audited.includes(key.split('.')[0])).sort();
    const spanish = leaves(es).filter(key => audited.includes(key.split('.')[0])).sort();
    expect(english.length).toBeGreaterThan(80);
    expect(spanish).toEqual(english);
  });
  it.each(['en', 'es'])('renders actual %s recovery and trust copy without fallback keys or unresolved placeholders', async language => {
    const instance = createInstance();
    await instance.init({ lng: language, fallbackLng: false, resources: { en: { translation: en }, es: { translation: es } }, interpolation: { escapeValue: false } });
    for (const key of ['coherence.trust.routes', 'coherence.trust.ownerNamed', 'coherence.preview.credentialError', 'coherence.preview.folderError', 'coherence.trust.revokeConfirmed']) {
      const rendered = instance.t(key, { count: 2, name: 'Fixture' });
      expect(rendered).not.toBe(key);
      expect(rendered).not.toContain('{{');
    }
    if (language === 'es') expect(instance.t('coherence.preview.credentialError')).toContain('descifrar');
  });
});

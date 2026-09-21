import { brand } from '@hiraya/config';

export function TitleBar({
  title = brand.shortName,
  subtitle = brand.appSubtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <header className="app-titlebar" aria-label={`${title} ${subtitle}`}>
      <img src="./images/hiraya-crest.png" alt="" width={22} height={22} />
      <strong className="app-title">{title}</strong>
      <span className="app-sublabel">{subtitle}</span>
    </header>
  );
}

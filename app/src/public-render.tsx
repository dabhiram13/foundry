import { renderToString } from 'react-dom/server';
import { PublicPage } from './public-page';

export function renderPublicPage() {
  return renderToString(<PublicPage />);
}

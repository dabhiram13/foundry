import { createRoot } from 'react-dom/client';
import { PublicPage } from './public-page';

const root = document.getElementById('foundry-public');
if (root) createRoot(root).render(<PublicPage />);

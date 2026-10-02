import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  Activity,
  AlertTriangle,
  Anvil,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bot,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleUserRound,
  Clock3,
  Clock,
  Command,
  Compass,
  Cpu,
  createIcons,
  Database,
  ExternalLink,
  FileText,
  Folder,
  FlaskConical,
  FolderKanban,
  GitBranch,
  Hammer,
  Layers3,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  PencilRuler,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  UserRound,
  Workflow,
  X,
} from 'lucide';

const iconSet = {
  Activity,
  AlertTriangle,
  Anvil,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bot,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleUserRound,
  Clock3,
  Clock,
  Command,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Folder,
  FlaskConical,
  FolderKanban,
  GitBranch,
  Hammer,
  Layers3,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  PencilRuler,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  UserRound,
  Workflow,
  X,
};

function renderMarkdown(value) {
  const html = marked.parse(String(value ?? ''), { breaks: true, gfm: true });
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['audio', 'button', 'embed', 'form', 'iframe', 'img', 'input', 'object',
      'picture', 'select', 'source', 'style', 'textarea', 'video'],
    FORBID_ATTR: ['src', 'srcset', 'style'],
  });
  const template = document.createElement('template');
  template.innerHTML = clean;
  template.content.querySelectorAll('a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!/^(https?:|mailto:)/i.test(href)) link.removeAttribute('href');
    if (link.hasAttribute('href')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  });
  return template.innerHTML;
}

function renderIcons() {
  createIcons({
    attrs: { 'aria-hidden': 'true', 'stroke-width': 1.8 },
    icons: iconSet,
  });
}

window.foundryUI = Object.freeze({ icons: renderIcons, renderMarkdown });

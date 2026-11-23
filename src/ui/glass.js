// Tiny helpers for the glass design system (styles live in glass.css).
import './glass.css';

/** Show a glass element with its entrance animation (display = 'flex' | 'grid' | 'block'). */
export function glassShow(el, display = 'flex') {
  clearTimeout(el._gt); el.classList.remove('g-out');
  if (el.style.display === display) return;
  el.style.display = display;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';   // restart the entrance animation
}

/** Hide with a short exit animation. */
export function glassHide(el) {
  if (el.style.display === 'none' || el.classList.contains('g-out')) return;
  el.classList.add('g-out');
  el._gt = setTimeout(() => { el.style.display = 'none'; el.classList.remove('g-out'); }, 150);
}

/** Make an element (existing or new) a glass surface. */
export function glass(el, ...cls) { el.classList.add('g-glass', ...cls); return el; }

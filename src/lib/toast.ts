type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  duration?: number;
}

function createToastContainer(): HTMLElement {
  let container = document.getElementById('pulse-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pulse-toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, type: ToastType = 'info', options: ToastOptions = {}) {
  const { duration = 3000 } = options;
  const container = createToastContainer();

  const toast = document.createElement('div');
  const colors: Record<ToastType, string> = {
    success: 'background: #16a34a; color: white;',
    error: 'background: #dc2626; color: white;',
    info: 'background: #27272a; color: #f4f4f5; border: 1px solid #3f3f46;',
  };

  toast.style.cssText = `
    padding: 10px 18px;
    border-radius: 9999px;
    font-size: 14px;
    font-weight: 500;
    ${colors[type]}
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    pointer-events: auto;
    white-space: nowrap;
    max-width: 90vw;
    text-overflow: ellipsis;
    overflow: hidden;
    transition: opacity 0.3s ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

export const toast = {
  success: (msg: string, opts?: ToastOptions) => showToast(msg, 'success', opts),
  error: (msg: string, opts?: ToastOptions) => showToast(msg, 'error', opts),
  info: (msg: string, opts?: ToastOptions) => showToast(msg, 'info', opts),
};

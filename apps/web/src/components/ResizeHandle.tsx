'use client';

type Props = {
  onResize: (deltaPx: number) => void;
};

export function ResizeHandle({ onResize }: Props) {
  function onMouseDown(e: React.MouseEvent): void {
    e.preventDefault();
    let lastX = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent): void => {
      const dx = ev.clientX - lastX;
      lastX = ev.clientX;
      if (dx !== 0) onResize(dx);
    };
    const onUp = (): void => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className="cursor-col-resize bg-[color:var(--color-border)] transition-colors hover:bg-[color:var(--color-accent)]/60"
    />
  );
}

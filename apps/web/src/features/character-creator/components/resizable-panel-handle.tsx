import { useEffect, useId, useRef, useState } from 'react';
import { LuGripVertical } from 'react-icons/lu';

import { cn } from '@~/lib/utils';

interface iResizablePanelHandleProps {
  ariaLabel: string;
  direction: -1 | 1;
  maxWidth: number;
  minWidth: number;
  onWidthChange: (width: number) => void;
  width: number;
}

export function ResizablePanelHandle({
  ariaLabel,
  direction,
  maxWidth,
  minWidth,
  onWidthChange,
  width,
}: iResizablePanelHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const descriptionId = useId();
  const dragStartRef = useRef({ pointerX: 0, width });

  useEffect(() => {
    if (!isDragging) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const delta = (event.clientX - dragStartRef.current.pointerX) * direction;
      onWidthChange(dragStartRef.current.width + delta);
    };
    const handlePointerUp = () => setIsDragging(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [direction, isDragging, onWidthChange]);

  return (
    <div
      role="slider"
      aria-label={ariaLabel}
      aria-describedby={descriptionId}
      aria-orientation="horizontal"
      aria-valuemax={maxWidth}
      aria-valuemin={minWidth}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      className={cn(
        'group relative z-20 w-2 shrink-0 cursor-col-resize touch-none border-0 bg-transparent p-0 outline-none',
        'before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2',
        'hover:before:bg-primary/70 focus-visible:before:w-0.5 focus-visible:before:bg-primary',
        isDragging ? 'before:w-0.5 before:bg-primary' : null,
      )}
      onPointerDown={(event) => {
        event.preventDefault();
        dragStartRef.current = { pointerX: event.clientX, width };
        setIsDragging(true);
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 24 : 8;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onWidthChange(width - step * direction);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          onWidthChange(width + step * direction);
        }
        if (event.key === 'Home') {
          event.preventDefault();
          onWidthChange(minWidth);
        }
        if (event.key === 'End') {
          event.preventDefault();
          onWidthChange(maxWidth);
        }
      }}
    >
      <span id={descriptionId} className="sr-only">
        Use left and right arrow keys to resize. Hold Shift for larger steps.
      </span>
      <span className="pointer-events-none absolute top-1/2 left-1/2 flex h-9 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <LuGripVertical className="size-3" />
      </span>
    </div>
  );
}

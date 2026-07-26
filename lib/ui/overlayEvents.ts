export type BlockingOverlayEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
};

/** Keep a backdrop gesture from closing the overlay or reaching page controls. */
export function blockOverlayEvent(event: BlockingOverlayEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

type SheetBodyLockTarget = {
  classList: Pick<DOMTokenList, 'add' | 'remove'>;
};

let sheetBodyLockCount = 0;

/** Keep concurrent sheets from releasing another sheet's global scroll lock. */
export function acquireSheetBodyLock(target: SheetBodyLockTarget): () => void {
  sheetBodyLockCount += 1;
  if (sheetBodyLockCount === 1) target.classList.add('sheet-open');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    sheetBodyLockCount = Math.max(0, sheetBodyLockCount - 1);
    if (sheetBodyLockCount === 0) target.classList.remove('sheet-open');
  };
}

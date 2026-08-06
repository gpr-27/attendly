"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";

const NEAR_BOTTOM_PX = 120;

type ScrollRoot = RefObject<HTMLElement | null> | undefined;

/**
 * Native page / panel scroll for chat — no inner overflow-y boxes.
 * Scrolls to bottom anchor when deps change, only if user is near bottom.
 */
export function useChatPageScroll(
  deps: unknown[],
  scrollRoot?: ScrollRoot,
) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const initialScrollDone = useRef(false);

  const getScrollElement = useCallback(() => {
    return scrollRoot?.current ?? document.documentElement;
  }, [scrollRoot]);

  const isNearBottom = useCallback(() => {
    const el = scrollRoot?.current;
    if (el) {
      return (
        el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
      );
    }
    const doc = document.documentElement;
    return (
      doc.scrollHeight - window.scrollY - window.innerHeight <= NEAR_BOTTOM_PX
    );
  }, [scrollRoot]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    },
    [],
  );

  useEffect(() => {
    const target = scrollRoot?.current ?? window;
    const onScroll = () => {
      stickToBottom.current = isNearBottom();
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [isNearBottom, scrollRoot]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    const behavior: ScrollBehavior = initialScrollDone.current
      ? "smooth"
      : "auto";
    scrollToBottom(behavior);
    initialScrollDone.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes message deps
  }, deps);

  return {
    bottomRef,
    scrollToBottom,
    stickToBottom,
    getScrollElement,
  };
}

"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AssistantMessageProps } from "@copilotkit/react-ui";
import { Markdown, useChatContext } from "@copilotkit/react-ui";

const MIN_SPEED = 2;
const MAX_SPEED = 10;
const BASE_CHARS_PER_MS = 0.08;
const BACKLOG_BOOST_DIVISOR = 80;
const MAX_BOOST_MULTIPLIER = 4;

export function SmoothAssistantMessage(props: AssistantMessageProps) {
  const { icons, labels } = useChatContext();
  const {
    message,
    isLoading,
    isGenerating,
    onRegenerate,
    onCopy,
    onThumbsUp,
    onThumbsDown,
    isCurrentMessage,
    feedback,
    markdownTagRenderers,
  } = props;

  const rawContent = message?.content || "";

  const [displayedText, setDisplayedText] = useState("");
  const [finalized, setFinalized] = useState(false);
  const [copied, setCopied] = useState(false);

  const queueRef = useRef("");
  const sourceRef = useRef("");
  const shownRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const ensureTicking = useCallback(() => {
    if (rafRef.current === null) {
      lastFrameTimeRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const stopTicking = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameTimeRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const elapsed = lastFrameTimeRef.current === null ? 16 : now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    const queue = queueRef.current;

    if (!queue) {
      rafRef.current = null;
      return;
    }

    const backlogBoost = 1 + Math.min(MAX_BOOST_MULTIPLIER, queue.length / BACKLOG_BOOST_DIVISOR);
    const timeBasedSpeed = Math.max(1, Math.floor(elapsed * BASE_CHARS_PER_MS * backlogBoost));
    const speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED * backlogBoost, timeBasedSpeed));
    const take = Math.min(queue.length, Math.max(1, Math.floor(speed)));
    const chunk = queue.slice(0, take);

    queueRef.current = queue.slice(take);
    const next = shownRef.current + chunk;
    shownRef.current = next;
    setDisplayedText(next);

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!isGenerating) {
      sourceRef.current = rawContent;

      // No buffered backlog -> never fake stream. Render final markdown immediately.
      if (queueRef.current.length === 0) {
        stopTicking();
        shownRef.current = rawContent;
        setDisplayedText(rawContent);
        setFinalized(true);
        return;
      }

      // Stream ended but UI still has backlog to drain: keep animation running.
      const tail = rawContent.slice(shownRef.current.length + queueRef.current.length);
      if (tail) queueRef.current += tail;
      setFinalized(false);
      ensureTicking();
      return;
    }

    setFinalized(false);

    const previous = sourceRef.current;
    if (rawContent.startsWith(previous)) {
      const delta = rawContent.slice(previous.length);
      if (delta) {
        queueRef.current += delta;
      }
      sourceRef.current = rawContent;
    } else {
      // Provider can occasionally rewrite whole message. Re-sync to latest snapshot.
      queueRef.current = "";
      sourceRef.current = rawContent;
      shownRef.current = rawContent;
      setDisplayedText(rawContent);
    }

    if (queueRef.current.length > 0) {
      ensureTicking();
    }
  }, [rawContent, isGenerating, ensureTicking, stopTicking]);

  useEffect(() => {
    if (isGenerating || queueRef.current.length > 0) return;
    if (shownRef.current === sourceRef.current) {
      setFinalized(true);
    }
  }, [isGenerating, displayedText]);

  useEffect(() => {
    return () => {
      stopTicking();
    };
  }, [stopTicking]);

  const handleCopy = () => {
    const text = message?.content || "";
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    onCopy?.(text);
    setTimeout(() => setCopied(false), 2000);
  };

  const subComponent = message?.generativeUI?.() ?? props.subComponent;
  const subComponentPosition = message?.generativeUIPosition ?? "after";
  const renderBefore = subComponent && subComponentPosition === "before";
  const renderAfter = subComponent && subComponentPosition !== "before";

  const visibleText = displayedText;
  return (
    <Fragment>
      {renderBefore && (
        <div style={{ marginBottom: "0.5rem" }}>{subComponent}</div>
      )}

      {visibleText ? (
        <div
          className={`copilotKitMessage copilotKitAssistantMessage${
            !finalized ? " smoothStreamingActive" : ""
          }`}
          style={!finalized ? { contain: "content" } : undefined}
        >
          <Markdown
            content={finalized ? rawContent : visibleText}
            components={markdownTagRenderers}
          />

          {finalized && (
            <div
              className={`copilotKitMessageControls ${isCurrentMessage ? "currentMessage" : ""}`}
            >
              <button
                className="copilotKitMessageControlButton"
                onClick={() => onRegenerate?.()}
                aria-label={labels.regenerateResponse}
                title={labels.regenerateResponse}
              >
                {icons.regenerateIcon}
              </button>
              <button
                className="copilotKitMessageControlButton"
                onClick={handleCopy}
                aria-label={labels.copyToClipboard}
                title={labels.copyToClipboard}
              >
                {copied ? (
                  <span style={{ fontSize: "10px", fontWeight: "bold" }}>✓</span>
                ) : (
                  icons.copyIcon
                )}
              </button>
              {onThumbsUp && (
                <button
                  className={`copilotKitMessageControlButton ${feedback === "thumbsUp" ? "active" : ""}`}
                  onClick={() => onThumbsUp(message!)}
                  aria-label={labels.thumbsUp}
                  title={labels.thumbsUp}
                >
                  {icons.thumbsUpIcon}
                </button>
              )}
              {onThumbsDown && (
                <button
                  className={`copilotKitMessageControlButton ${feedback === "thumbsDown" ? "active" : ""}`}
                  onClick={() => onThumbsDown(message!)}
                  aria-label={labels.thumbsDown}
                  title={labels.thumbsDown}
                >
                  {icons.thumbsDownIcon}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        isLoading && (
          <div className="copilotKitMessage copilotKitAssistantMessage">
            <span>{icons.activityIcon}</span>
          </div>
        )
      )}

      {renderAfter && (
        <div style={{ marginTop: "0.5rem" }}>{subComponent}</div>
      )}
    </Fragment>
  );
}

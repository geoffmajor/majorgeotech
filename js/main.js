(() => {
  /**
   * Global site behavior for this page.
   *
   * Kept in one IIFE to avoid leaking globals.
   *
   * Includes:
   * - Footer year
   * - CSS scroll padding for anchor jumps (accounts for the sticky header)
   * - Contact modal (hash support, focus trap, Escape, copy-to-clipboard)
   * - Gallery carousel (crossfade, infinite loop, swipe, keyboard, optional autoplay)
   */

  // ============================================================================
  // Footer Year
  // ============================================================================
  // Dynamically update the copyright year in the footer.
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // ============================================================================
  // Scroll Padding for Sticky Header
  // ============================================================================
  // Calculate and set CSS scroll padding to prevent anchor links from landing
  // under the sticky header. Updates on resize to handle dynamic header height.
  const header = document.querySelector("[data-header]");
  const getHeaderH = () => (header ? Math.ceil(header.getBoundingClientRect().height) : 0);

  const setScrollPad = () => {
    const h = getHeaderH();
    // Minimum keeps spacing comfortable even if the header is very small.
    const pad = Math.max(72, h + 14);
    document.documentElement.style.setProperty("--scroll-pad", `${pad}px`);
  };

  setScrollPad();
  window.addEventListener("resize", setScrollPad, { passive: true });

  // ============================================================================
  // Accessibility: Reduced Motion Preference
  // ============================================================================
  // Respect user's motion preferences for autoplay and animations.
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ============================================================================
  // Contact Modal
  // ============================================================================
  // Modal dialog for contact information with hash-based navigation, focus
  // trapping, keyboard support, and copy-to-clipboard functionality.
  const modal = document.querySelector("[data-contact-modal]");
  const panel = document.querySelector("[data-contact-panel]");
  const openers = Array.from(document.querySelectorAll("[data-contact-open]"));
  const closers = Array.from(document.querySelectorAll("[data-contact-close]"));

  // Track the element that opened the modal so we can restore focus on close.
  let lastFocus = null;

  /**
   * Get all focusable elements within a root element.
   * Filters out hidden elements and disabled buttons.
   * @param {HTMLElement} root - The root element to search within
   * @returns {HTMLElement[]} Array of focusable elements
   */
  const getFocusable = (root) => {
    const sel =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll(sel)).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none";
    });
  };

  const openContact = () => {
    if (!modal || !panel) return;
    if (!modal.hasAttribute("hidden")) return;

    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    modal.removeAttribute("hidden");
    document.body.classList.add("modal-open");

    // Keep the URL shareable while the modal is open.
    if (location.hash !== "#contact") {
      history.replaceState(null, "", "#contact");
    }

    // Focus the panel so keyboard users land in the dialog.
    window.setTimeout(() => {
      panel.focus({ preventScroll: true });
    }, 0);
  };

  const closeContact = () => {
    if (!modal || !panel) return;
    if (modal.hasAttribute("hidden")) return;

    modal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");

    // Remove the hash when closing (so Back doesn't immediately re-open).
    if (location.hash === "#contact") {
      history.replaceState(null, "", location.pathname + location.search);
    }

    if (lastFocus) {
      window.setTimeout(() => {
        try {
          lastFocus.focus({ preventScroll: true });
        } catch {
          // If the element is gone, do nothing.
        }
      }, 0);
    }
  };

  // Open the modal if the page loads (or later navigates) to #contact.
  const openOnHash = () => {
    if (location.hash === "#contact") openContact();
  };
  openOnHash();
  window.addEventListener("hashchange", openOnHash);

  openers.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openContact();
    });
  });

  closers.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeContact();
    });
  });

  // Focus trap + Escape to close.
  document.addEventListener("keydown", (e) => {
    if (!modal || modal.hasAttribute("hidden")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeContact();
      return;
    }

    if (e.key !== "Tab") return;
    if (!panel) return;

    const focusables = getFocusable(panel);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const active = document.activeElement;
    const isShift = e.shiftKey;

    if (isShift && active === first) {
      e.preventDefault();
      last.focus();
      return;
    }

    if (!isShift && active === last) {
      e.preventDefault();
      first.focus();
      return;
    }
  });

  /**
   * Copy text to clipboard with fallback for older browsers.
   * Uses modern Clipboard API when available, falls back to execCommand.
   * @param {string} text - The text to copy
   * @returns {Promise<boolean>} True if copy succeeded, false otherwise
   */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers or strict security contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  };

  const copyEmailBtn = document.querySelector("[data-copy-email]");
  const copyStatus = document.querySelector("[data-copy-status]");
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener("click", async () => {
      const email = copyEmailBtn.getAttribute("data-email") || "";
      if (!email) return;
      const ok = await copyText(email);
      if (copyStatus) {
        copyStatus.textContent = ok ? "Copied." : "Could not copy.";
        window.setTimeout(() => {
          copyStatus.textContent = "";
        }, 1400);
      }
    });
  }

  // If there's a plain #contact anchor somewhere, treat it like an "open modal" action.
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;

      const href = a.getAttribute("href") || "";
      const id = href.startsWith("#") ? href.slice(1) : "";
      if (id === "contact") {
        e.preventDefault();
        openContact();
      }
    },
    true
  );

  // ============================================================================
  // Gallery Carousel
  // ============================================================================
  // Interactive image carousel with crossfade transitions, infinite loop,
  // swipe gestures, keyboard navigation, and optional autoplay.
  // Early return if carousel elements are not found.
  const root = document.querySelector("[data-carousel]");
  if (!root) return;

  // Carousel DOM elements
  const track = root.querySelector("[data-track]");
  const slides = Array.from(root.querySelectorAll(".slide"));
  const prev = root.querySelector("[data-prev]");
  const next = root.querySelector("[data-next]");
  const dotsWrap = root.querySelector("[data-dots]");
  const toggleAuto = root.querySelector("[data-toggle]");
  const toggleLabel = root.querySelector("[data-toggle-label]");
  const progress = root.querySelector("[data-progress]");
  const frame = root.querySelector(".carousel-frame");
  const viewBtn = root.querySelector("[data-view]");

  // Validate required elements exist
  if (!track || slides.length === 0 || !prev || !next || !dotsWrap || !toggleAuto || !frame) return;

  // Carousel state
  const n = slides.length;
  let index = 0;

  // Ensure the first frame always paints quickly (no blank carousel on first load).
  const firstImg = slides[0].querySelector("img");
  if (firstImg) {
    firstImg.loading = "eager";
    firstImg.fetchPriority = "high";
  }

  // Build dots based on the number of slides.
  const dots = slides.map((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dot";
    b.setAttribute("aria-label", `Go to image ${i + 1}`);
    b.addEventListener("click", () => goTo(i, true));
    dotsWrap.appendChild(b);
    return b;
  });

  /**
   * Clamp index to valid range using modulo for infinite loop.
   * @param {number} i - The index to clamp
   * @returns {number} Valid index within [0, n-1]
   */
  const clamp = (i) => (i + n) % n;

  /**
   * Update active slide state and accessibility attributes.
   * Manages tabindex for focus management and aria-current for pagination.
   */
  const setActive = () => {
    slides.forEach((s, i) => {
      const isActive = i === index;
      s.classList.toggle("is-active", isActive);
      s.setAttribute("aria-hidden", isActive ? "false" : "true");

      // Keep non-active slides out of the tab order so keyboard focus doesn't disappear.
      const focusables = s.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
      focusables.forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (isActive) {
          if (el.hasAttribute("data-prev-tabindex")) {
            el.setAttribute("tabindex", el.getAttribute("data-prev-tabindex"));
            el.removeAttribute("data-prev-tabindex");
          } else if (el.getAttribute("tabindex") === "-1") {
            el.removeAttribute("tabindex");
          }
        } else {
          if (el.hasAttribute("tabindex")) {
            el.setAttribute("data-prev-tabindex", el.getAttribute("tabindex"));
          }
          el.setAttribute("tabindex", "-1");
        }
      });
    });

    dots.forEach((d, i) => {
      if (i === index) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
  };

  /**
   * Navigate to a specific slide.
   * @param {number} i - Target slide index
   * @param {boolean} user - Whether this was triggered by user interaction
   */
  const goTo = (i, user = false) => {
    index = clamp(i);
    setActive();
    if (user) restartAuto();
  };

  /**
   * Navigate to next/previous slide.
   * @param {number} dir - Direction: -1 for previous, 1 for next
   * @param {boolean} user - Whether this was triggered by user interaction
   */
  const step = (dir, user = false) => goTo(index + dir, user);

  prev.addEventListener("click", () => step(-1, true));
  next.addEventListener("click", () => step(1, true));

  // Keyboard support (when the carousel has focus).
  const onKey = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1, true);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1, true);
    }
  };
  root.addEventListener("keydown", onKey);
  track.addEventListener("keydown", onKey);

  // ============================================================================
  // Swipe Gesture Handling (Pointer Events)
  // ============================================================================
  // Implements horizontal swipe detection with axis locking to preserve
  // vertical scrolling. Suppresses click events after swipes to prevent
  // accidental interactions.
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let axis = null;
  // Used to prevent the "tap" handler from firing after a swipe.
  let didSwipe = false;
  let suppressNextClickUntil = 0;

  const onDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    axis = null;
    didSwipe = false;
    startX = e.clientX;
    startY = e.clientY;
    frame.setPointerCapture?.(e.pointerId);
    tempPause();
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!axis) {
      // Ignore tiny movements so clicks/taps still feel normal.
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }

    // If we're swiping horizontally, prevent the page from scrolling.
    if (axis === "x") {
      didSwipe = true;
      e.preventDefault();
    }
  };

  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;

    if (axis !== "x") {
      tempResume();
      return;
    }

    const dx = e.clientX - startX;
    const threshold = Math.max(40, frame.getBoundingClientRect().width * 0.12);

    if (dx > threshold) step(-1, true);
    else if (dx < -threshold) step(1, true);

    // Some mobile browsers fire a click after a swipe. Suppress it so we do not
    // treat the swipe like a tap on the frame.
    if (didSwipe) suppressNextClickUntil = performance.now() + 450;

    tempResume();
  };

  frame.addEventListener("pointerdown", onDown);
  frame.addEventListener("pointermove", onMove, { passive: false });
  frame.addEventListener("pointerup", onUp);
  frame.addEventListener("pointercancel", onUp);

  // ============================================================================
  // Autoplay Timer System
  // ============================================================================
  // Manages carousel autoplay with progress indicator. Uses requestAnimationFrame
  // for smooth progress updates. Tracks "enabled" separately from "running" so
  // temporary pauses (swipe/hover/focus) don't flip the Play/Pause label.
  const intervalMs = 6500;
  let autoplayEnabled = !prefersReducedMotion;
  let running = false;
  let rafId = 0;
  let lastTickTs = 0;
  let elapsedCarry = 0;

  const setToggleA11y = () => {
    const isPlaying = autoplayEnabled && !prefersReducedMotion;
    if (toggleLabel) toggleLabel.textContent = isPlaying ? "Pause" : "Play";
    toggleAuto.setAttribute("aria-label", isPlaying ? "Pause slideshow" : "Play slideshow");
  };

  const renderProgress = (elapsedMs) => {
    const pct = Math.min(100, (elapsedMs / intervalMs) * 100);
    if (progress) progress.style.width = `${pct}%`;
  };

  const tick = (ts) => {
    if (!running || !autoplayEnabled || prefersReducedMotion) return;

    if (!lastTickTs) lastTickTs = ts;
    const elapsed = elapsedCarry + (ts - lastTickTs);
    renderProgress(elapsed);

    if (elapsed >= intervalMs) {
      elapsedCarry = 0;
      lastTickTs = ts;
      if (progress) progress.style.width = "0%";
      step(1, false);
    }

    rafId = requestAnimationFrame(tick);
  };

  const pauseTimer = ({ resetProgress = false } = {}) => {
    if (!running) return;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    if (lastTickTs) {
      elapsedCarry += performance.now() - lastTickTs;
      lastTickTs = 0;
    }

    if (resetProgress) {
      elapsedCarry = 0;
      if (progress) progress.style.width = "0%";
    }
  };

  const startTimer = ({ resetProgress = true } = {}) => {
    if (!autoplayEnabled || prefersReducedMotion) return;
    running = true;

    if (resetProgress) {
      elapsedCarry = 0;
      if (progress) progress.style.width = "0%";
    }

    lastTickTs = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  };

  const restartAuto = () => {
    if (!autoplayEnabled || prefersReducedMotion) return;
    elapsedCarry = 0;
    lastTickTs = 0;
    if (progress) progress.style.width = "0%";
  };

  const setAutoplayEnabled = (enabled) => {
    autoplayEnabled = Boolean(enabled) && !prefersReducedMotion;
    setToggleA11y();
    if (autoplayEnabled) startTimer({ resetProgress: true });
    else pauseTimer({ resetProgress: true });
  };

  toggleAuto.addEventListener("click", () => {
    setAutoplayEnabled(!autoplayEnabled);
  });

  // Temporarily pause autoplay while the user interacts.
  let tempWasRunning = false;
  const tempPause = () => {
    if (!autoplayEnabled || prefersReducedMotion) return;
    tempWasRunning = running;
    pauseTimer({ resetProgress: false });
  };
  const tempResume = () => {
    if (!autoplayEnabled || prefersReducedMotion) return;
    if (tempWasRunning) startTimer({ resetProgress: false });
  };

  frame.addEventListener("mouseenter", tempPause);
  frame.addEventListener("mouseleave", tempResume);
  frame.addEventListener("focusin", tempPause);
  frame.addEventListener("focusout", tempResume);

  // Tap/click the image area to toggle autoplay.
  // Also supports a quick double-tap / double-click to open the viewer while paused.
  let lastTapAt = 0;
  frame.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (performance.now() < suppressNextClickUntil) return;
    if (target.closest("[data-prev], [data-next], [data-toggle], [data-view], .dot")) return;

    const now = performance.now();
    const isDoubleTap = now - lastTapAt < 320;
    lastTapAt = now;

    // If paused and the user double-taps, open the viewer.
    if (!autoplayEnabled && isDoubleTap) {
      openViewer();
      return;
    }

    setAutoplayEnabled(!autoplayEnabled);
  });

  // Desktop-friendly: double click opens the viewer.
  frame.addEventListener("dblclick", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-prev], [data-next], [data-toggle], [data-view], .dot")) return;
    openViewer();
  });

  // ============================================================================
  // Image Viewer Modal
  // ============================================================================
  // Full-screen image viewer synchronized with carousel state. Supports
  // keyboard navigation, focus trapping, and preserves autoplay state.
  const imageModal = document.querySelector("[data-image-modal]");
  const imagePanel = document.querySelector("[data-image-panel]");
  const imageCloseEls = Array.from(document.querySelectorAll("[data-image-close]"));
  const imagePrev = document.querySelector("[data-image-prev]");
  const imageNext = document.querySelector("[data-image-next]");
  const imageFull = document.querySelector("[data-image-full]");
  const imageCaption = document.querySelector("[data-image-caption]");
  const imageTitle = document.querySelector("[data-image-title]") || document.getElementById("image-title");

  let imageLastFocus = null;
  let resumeAfterViewer = false;

  /**
   * Get the currently active slide element.
   * @returns {HTMLElement|null} The active slide element
   */
  const getActiveSlide = () => slides[index];

  /**
   * Get the image element from the currently active slide.
   * @returns {HTMLImageElement|null} The active slide's image element
   */
  const getActiveImg = () => getActiveSlide()?.querySelector("img");

  /**
   * Update the image viewer with the current slide's content.
   * Uses the highest quality image source available (from srcset).
   */
  const updateViewer = () => {
    if (!imageFull || !imageCaption) return;
    const img = getActiveImg();
    if (!img) return;

    // Prefer the highest quality source available (from srcset).
    const src = img.currentSrc || img.getAttribute("src") || "";
    const alt = img.getAttribute("alt") || "";
    const cap = getActiveSlide()?.querySelector("figcaption")?.textContent || alt;

    imageFull.src = src;
    imageFull.alt = alt;
    imageCaption.textContent = cap;
    if (imageTitle) imageTitle.textContent = cap || "Photo";
  };

  const openViewer = () => {
    if (!imageModal || !imagePanel) return;
    if (!imageModal.hasAttribute("hidden")) return;

    imageLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resumeAfterViewer = autoplayEnabled;
    tempPause();

    updateViewer();
    imageModal.removeAttribute("hidden");
    document.body.classList.add("modal-open");

    window.setTimeout(() => {
      imagePanel.focus({ preventScroll: true });
    }, 0);
  };

  const closeViewer = () => {
    if (!imageModal || !imagePanel) return;
    if (imageModal.hasAttribute("hidden")) return;

    imageModal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");

    if (imageLastFocus) {
      window.setTimeout(() => {
        try {
          imageLastFocus.focus({ preventScroll: true });
        } catch {
          // ignore
        }
      }, 0);
    }

    if (resumeAfterViewer && autoplayEnabled && !prefersReducedMotion) {
      startTimer({ resetProgress: false });
    }
  };

  if (viewBtn) viewBtn.addEventListener("click", openViewer);
  imageCloseEls.forEach((el) => el.addEventListener("click", (e) => {
    e.preventDefault();
    closeViewer();
  }));
  if (imagePrev) imagePrev.addEventListener("click", () => {
    step(-1, true);
    updateViewer();
  });
  if (imageNext) imageNext.addEventListener("click", () => {
    step(1, true);
    updateViewer();
  });

  document.addEventListener("keydown", (e) => {
    if (!imageModal || imageModal.hasAttribute("hidden")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeViewer();
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1, true);
      updateViewer();
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1, true);
      updateViewer();
      return;
    }

    if (e.key !== "Tab" || !imagePanel) return;
    const focusables = getFocusable(imagePanel);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    const isShift = e.shiftKey;

    if (isShift && active === first) {
      e.preventDefault();
      last.focus();
      return;
    }
    if (!isShift && active === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // ============================================================================
  // Initialization
  // ============================================================================
  // Set up initial carousel state: accessibility labels, active slide, and
  // start autoplay if enabled and motion is not reduced.
  setToggleA11y();
  setActive();
  if (autoplayEnabled && !prefersReducedMotion) startTimer({ resetProgress: true });
})();

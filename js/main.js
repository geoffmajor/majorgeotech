(() => {
  /**
   * Site behavior:
   * - Updates the footer year
   * - Sets a CSS scroll padding var so in-page anchors land below the sticky header
   * - Contact modal (supports #contact, focus trap, Escape, and copy-to-clipboard)
   * - Carousel (crossfade, infinite loop, swipe, keyboard, optional autoplay)
   */

  // --- Footer year ---
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // --- Sticky header: keep anchor jumps from hiding under the header ---
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

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Contact modal ---
  const modal = document.querySelector("[data-contact-modal]");
  const panel = document.querySelector("[data-contact-panel]");
  const openers = Array.from(document.querySelectorAll("[data-contact-open]"));
  const closers = Array.from(document.querySelectorAll("[data-contact-close]"));

  // Track the element that opened the modal so we can restore focus on close.
  let lastFocus = null;

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

  // Open the modal if the page loads (or navigates) to #contact.
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

  // Clipboard helper with a small fallback for older/stricter browsers.
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
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

  // --- Carousel (crossfade, infinite loop, swipe) ---
  const root = document.querySelector("[data-carousel]");
  if (!root) return;

  const track = root.querySelector("[data-track]");
  const slides = Array.from(root.querySelectorAll(".slide"));
  const prev = root.querySelector("[data-prev]");
  const next = root.querySelector("[data-next]");
  const dotsWrap = root.querySelector("[data-dots]");
  const toggleAuto = root.querySelector("[data-toggle]");
  const toggleLabel = root.querySelector("[data-toggle-label]");
  const progress = root.querySelector("[data-progress]");
  const frame = root.querySelector(".carousel-frame");

  if (!track || slides.length === 0 || !prev || !next || !dotsWrap || !toggleAuto || !frame) return;

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

  const clamp = (i) => (i + n) % n;

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

  const goTo = (i, user = false) => {
    index = clamp(i);
    setActive();
    if (user) restartAuto();
  };

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

  // Swipe (Pointer Events) with a little axis-lock so vertical scroll still works.
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let axis = null;

  const onDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    axis = null;
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
    if (axis === "x") e.preventDefault();
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

    tempResume();
  };

  frame.addEventListener("pointerdown", onDown);
  frame.addEventListener("pointermove", onMove, { passive: false });
  frame.addEventListener("pointerup", onUp);
  frame.addEventListener("pointercancel", onUp);

  // --- Autoplay + progress ---
  // Uses requestAnimationFrame so the progress bar stays in sync.
  let auto = !prefersReducedMotion;
  const intervalMs = 6500;
  let startTs = 0;
  let rafId = 0;

  const setToggleA11y = () => {
    const isPlaying = auto && !prefersReducedMotion;
    if (toggleLabel) toggleLabel.textContent = isPlaying ? "Pause" : "Play";
    toggleAuto.setAttribute("aria-label", isPlaying ? "Pause slideshow" : "Play slideshow");
  };

  const tick = (ts) => {
    if (!auto || prefersReducedMotion) return;
    if (!startTs) startTs = ts;

    const elapsed = ts - startTs;
    const pct = Math.min(100, (elapsed / intervalMs) * 100);
    if (progress) progress.style.width = `${pct}%`;

    if (elapsed >= intervalMs) {
      startTs = ts;
      step(1, false);
    }

    rafId = requestAnimationFrame(tick);
  };

  const stopAuto = () => {
    auto = false;
    if (progress) progress.style.width = "0%";
    startTs = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    setToggleA11y();
  };

  const startAuto = () => {
    if (prefersReducedMotion) return;
    auto = true;
    startTs = 0;
    setToggleA11y();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  };

  const restartAuto = () => {
    if (!auto || prefersReducedMotion) return;
    startTs = 0;
    if (progress) progress.style.width = "0%";
  };

  toggleAuto.addEventListener("click", () => {
    if (auto) stopAuto();
    else startAuto();
  });

  // Temporarily pause autoplay while the user interacts.
  let wasRunning = auto;
  const tempPause = () => {
    wasRunning = auto;
    if (auto) stopAuto();
  };
  const tempResume = () => {
    if (wasRunning && !prefersReducedMotion) startAuto();
  };

  frame.addEventListener("mouseenter", tempPause);
  frame.addEventListener("mouseleave", tempResume);
  frame.addEventListener("focusin", tempPause);
  frame.addEventListener("focusout", tempResume);

  // Init
  setToggleA11y();
  setActive();
  if (auto && !prefersReducedMotion) rafId = requestAnimationFrame(tick);
})();

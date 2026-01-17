(() => {
  // Footer year
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Header height -> CSS scroll padding
  const header = document.querySelector("[data-header]");
  const getHeaderH = () => (header ? Math.ceil(header.getBoundingClientRect().height) : 0);

  const setScrollPad = () => {
    const h = getHeaderH();
    const pad = Math.max(72, h + 14);
    document.documentElement.style.setProperty("--scroll-pad", `${pad}px`);
  };

  setScrollPad();
  window.addEventListener("resize", setScrollPad, { passive: true });

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Contact Modal ---
  const modal = document.querySelector("[data-contact-modal]");
  const panel = document.querySelector("[data-contact-panel]");
  const openers = Array.from(document.querySelectorAll("[data-contact-open]"));
  const closers = Array.from(document.querySelectorAll("[data-contact-close]"));

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

    if (location.hash !== "#contact") {
      history.replaceState(null, "", "#contact");
    }

    window.setTimeout(() => {
      panel.focus({ preventScroll: true });
    }, 0);
  };

  const closeContact = () => {
    if (!modal || !panel) return;
    if (modal.hasAttribute("hidden")) return;

    modal.setAttribute("hidden", "");
    document.body.classList.remove("modal-open");

    if (location.hash === "#contact") {
      history.replaceState(null, "", location.pathname + location.search);
    }

    if (lastFocus) {
      window.setTimeout(() => {
        try {
          lastFocus.focus({ preventScroll: true });
        } catch {
          // no-op
        }
      }, 0);
    }
  };

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

  // Trap focus + Esc
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

  // Copy helpers
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

  // Copy email
  const copyEmailBtn = document.querySelector("[data-copy-email]");
  const copyStatus = document.querySelector("[data-copy-status]");
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener("click", async () => {
      const email = copyEmailBtn.getAttribute("data-email") || "";
      if (!email) return;
      const ok = await copyText(email);
      if (copyStatus) {
        copyStatus.textContent = ok ? "Copied." : "Could not copy.";
        window.setTimeout(() => { copyStatus.textContent = ""; }, 1400);
      }
    });
  }

  // Intercept #contact anchor clicks (if any)
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

  // --- Carousel ---
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

  if (!track || slides.length === 0 || !prev || !next || !dotsWrap || !toggleAuto) return;

  let index = 0;
  let auto = !prefersReduced;
  const intervalMs = 6500;

  const setToggleA11y = () => {
  if (!toggleAuto) return;
  const isPlaying = auto && !prefersReduced;
  const label = isPlaying ? "Pause" : "Play";
  if (toggleLabel) toggleLabel.textContent = label;
  toggleAuto.setAttribute("aria-label", isPlaying ? "Pause slideshow" : "Play slideshow");
};

  // Scroll-snap based carousel.
  // This avoids WebKit rounding glitches that can happen when animating a
  // transformed track inside an overflow+radius container.
  const getSlideWidth = () => track.getBoundingClientRect().width;

  const dots = slides.map((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dot";
    b.setAttribute("aria-label", `Go to slide ${i + 1}`);
    b.addEventListener("click", () => goTo(i, true));
    dotsWrap.appendChild(b);
    return b;
  });

  const clampIndex = (i) => (i + slides.length) % slides.length;

  const setDots = () => {
    dots.forEach((d, i) => {
      if (i === index) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
  };

  const scrollToIndex = (i, behavior) => {
    const w = getSlideWidth();
    track.scrollTo({ left: i * w, top: 0, behavior });
  };

  const render = (behavior = "auto") => {
    index = clampIndex(index);
    scrollToIndex(index, behavior);
    setDots();
  };

  const goTo = (i, user = false) => {
    index = clampIndex(i);
    const behavior = prefersReduced ? "auto" : "smooth";
    render(user ? behavior : "auto");
    if (user) restartAuto();
  };

  const step = (dir) => goTo(index + dir, true);

  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));

  // Keep index in sync with manual scrolling / swipe.
  let raf = 0;
  const syncFromScroll = () => {
    raf = 0;
    const w = Math.max(1, getSlideWidth());
    const nextIndex = clampIndex(Math.round(track.scrollLeft / w));
    if (nextIndex !== index) {
      index = nextIndex;
      setDots();
      restartAuto();
    }
  };

  track.addEventListener(
    "scroll",
    () => {
      if (raf) return;
      raf = requestAnimationFrame(syncFromScroll);
    },
    { passive: true }
  );

  // Autoplay + progress
  let startTs = 0;
  const tick = (ts) => {
    if (!auto || prefersReduced) return;
    if (!startTs) startTs = ts;

    const elapsed = ts - startTs;
    const pct = Math.min(100, (elapsed / intervalMs) * 100);
    if (progress) progress.style.width = `${pct}%`;

    if (elapsed >= intervalMs) {
      startTs = ts;
      goTo(index + 1, false);
    }

    requestAnimationFrame(tick);
  };

  const stopAuto = () => {
    auto = false;
    if (progress) progress.style.width = "0%";
    startTs = 0;
    setToggleA11y();
  };

  const startAuto = () => {
    if (prefersReduced) return;
    auto = true;
    startTs = 0;
    setToggleA11y();
    requestAnimationFrame(tick);
  };

  const restartAuto = () => {
    if (!auto || prefersReduced) return;
    startTs = 0;
    if (progress) progress.style.width = "0%";
  };

  toggleAuto.addEventListener("click", () => {
    if (auto) stopAuto();
    else startAuto();
  });

  // Pause autoplay on hover/focus
  let wasRunning = auto;
  const tempPause = () => {
    wasRunning = auto;
    if (auto) stopAuto();
  };
  const tempResume = () => {
    if (wasRunning && !prefersReduced) startAuto();
  };

  if (frame) {
    frame.addEventListener("mouseenter", tempPause);
    frame.addEventListener("mouseleave", tempResume);
    frame.addEventListener("focusin", tempPause);
    frame.addEventListener("focusout", tempResume);
  }

  // Keyboard support
  const onCarouselKeydown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    }
  };

  root.addEventListener("keydown", onCarouselKeydown);
  track.addEventListener("keydown", onCarouselKeydown);

  // Optional mouse drag-to-scroll (mobile gets native swipe).
  let dragging = false;
  let dragStartX = 0;
  let dragStartLeft = 0;

  if (frame) {
    frame.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      dragging = true;
      dragStartX = e.clientX;
      dragStartLeft = track.scrollLeft;
      frame.setPointerCapture?.(e.pointerId);
    });

    frame.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const dx = e.clientX - dragStartX;
      track.scrollLeft = dragStartLeft - dx;
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;

      // Snap to nearest slide immediately after dragging stops.
      const w = Math.max(1, getSlideWidth());
      index = clampIndex(Math.round(track.scrollLeft / w));
      render("smooth");
      restartAuto();
    };

    frame.addEventListener("pointerup", endDrag);
    frame.addEventListener("pointercancel", endDrag);
    frame.addEventListener("pointerleave", endDrag);
  }

  render("auto");
  setToggleA11y();
  if (auto && !prefersReduced) requestAnimationFrame(tick);
})();

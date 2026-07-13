const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const revealItems = document.querySelectorAll(".reveal");
const flashcard = document.querySelector("[data-flashcard]");
const modeTabs = document.querySelectorAll("[data-mode]");
const ratingButtons = document.querySelectorAll("[data-rating]");
const cardTag = document.querySelector("[data-card-tag]");
const cardTitle = document.querySelector("[data-card-title]");
const cardCopy = document.querySelector("[data-card-copy]");

const modeContent = {
  question: {
    tag: "AI Question",
    title: "Why does supervised learning need labeled examples?",
    copy: "Answer using the uploaded lesson on training datasets and validation sets."
  },
  flashcard: {
    tag: "Flashcard",
    title: "Define prerequisite topic.",
    copy: "A concept that must be understood before the next topic can be learned reliably."
  },
  path: {
    tag: "Adaptive Path",
    title: "Next: Model Evaluation",
    copy: "Unlocked because training data, validation data, and overfitting are above the mastery threshold."
  }
};

function setHeaderState() {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 16);
}

function closeNavigation() {
  if (!nav || !navToggle) return;
  nav.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("nav-open");
}

function toggleNavigation() {
  if (!nav || !navToggle) return;
  const isOpen = nav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("nav-open", isOpen);
}

function setupRevealAnimation() {
  if (!revealItems.length) return;

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14 }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    observer.observe(item);
  });
}

function flipFlashcard() {
  if (!flashcard) return;
  flashcard.classList.toggle("is-flipped");
}

function setMode(mode) {
  const content = modeContent[mode];
  if (!content || !flashcard || !cardTag || !cardTitle || !cardCopy) return;

  modeTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
  });

  flashcard.classList.remove("is-flipped");
  cardTag.textContent = content.tag;
  cardTitle.textContent = content.title;
  cardCopy.textContent = content.copy;
}

function setRating(button) {
  ratingButtons.forEach((item) => item.classList.remove("is-selected"));
  button.classList.add("is-selected");

  if (flashcard) {
    flashcard.classList.remove("is-flipped");
  }
}

window.addEventListener("scroll", setHeaderState, { passive: true });
navToggle?.addEventListener("click", toggleNavigation);
nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNavigation));

flashcard?.addEventListener("click", flipFlashcard);
flashcard?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  flipFlashcard();
});

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

ratingButtons.forEach((button) => {
  button.addEventListener("click", () => setRating(button));
});



function setupStatsCountUp() {
  const stats = document.querySelectorAll(".stat-num");
  if (!stats.length) return;

  const animateStat = (el) => {
    const target = parseInt(el.getAttribute("data-val") || "0", 10);
    const suffix = el.getAttribute("data-suffix") || "";
    let count = 0;
    const speed = target / 80; // duration speed adjustment

    const updateCount = () => {
      count += speed;
      if (count < target) {
        el.textContent = Math.floor(count).toLocaleString() + suffix;
        setTimeout(updateCount, 15);
      } else {
        el.textContent = target.toLocaleString() + suffix;
      }
    };
    updateCount();
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateStat(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  stats.forEach((stat) => observer.observe(stat));
}

setHeaderState();
setupRevealAnimation();
setupStatsCountUp();

function initHIWStepCycling() {
  const steps = document.querySelectorAll(".hiw-card");
  const progressLine = document.getElementById("hiw-progress-line");
  const section = document.querySelector(".hiw-steps");
  if (!steps.length || !progressLine || !section) return;

  let currentIndex = 0;
  const totalSteps = steps.length;
  let cycleInterval = null;
  let isCycling = false;
  let resumeTimeout = null;

  function setActiveStep(index) {
    steps.forEach((step, i) => {
      if (i === index) {
        step.classList.add("is-active");
      } else {
        step.classList.remove("is-active");
      }
    });

    const pct = (index / (totalSteps - 1)) * 100;
    progressLine.style.width = `${pct}%`;
  }

  function startCycling() {
    if (isCycling) return;
    isCycling = true;
    cycleInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % totalSteps;
      setActiveStep(currentIndex);
    }, 800);
  }


  function stopCycling() {
    if (cycleInterval) {
      clearInterval(cycleInterval);
      cycleInterval = null;
    }
    isCycling = false;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        startCycling();
      } else {
        stopCycling();
      }
    });
  }, { threshold: 0.15 });
  observer.observe(section);

  setActiveStep(0);

  steps.forEach((step, i) => {
    step.addEventListener("click", () => {
      currentIndex = i;
      setActiveStep(i);
      stopCycling();

      if (resumeTimeout) clearTimeout(resumeTimeout);
      resumeTimeout = setTimeout(() => {
        startCycling();
      }, 6000);
    });
  });
}

initHIWStepCycling();

// ── Popup Modal Booking Form Logic ──
const demoModal = document.getElementById("demo-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const demoBookingForm = document.getElementById("demo-booking-form");
const bookingStatus = document.getElementById("booking-status");
const modalDate = document.getElementById("modal-date");
let modalTrigger = null;

function getBookingApiUrl() {
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (window.location.protocol === "file:" || (isLocalHost && window.location.port !== "8000")) {
    return "http://127.0.0.1:8000/api/book";
  }
  if (isLocalHost) return "/api/book";
  return "https://socialstudying-api-6d3225.azurewebsites.net/api/book";
}

if (modalDate) {
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  modalDate.min = localToday.toISOString().split("T")[0];
}

function openModal(e) {
  if (e) e.preventDefault();
  if (demoModal) {
    modalTrigger = e?.currentTarget || document.activeElement;
    if (bookingStatus) {
      bookingStatus.textContent = "";
      bookingStatus.className = "form-status";
    }
    demoModal.classList.add("is-open");
    demoModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden"; // Disable background scrolling
    window.setTimeout(() => document.getElementById("modal-first-name")?.focus(), 80);
  }
}

function closeModal() {
  if (demoModal) {
    demoModal.classList.remove("is-open");
    demoModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = ""; // Re-enable background scrolling
    modalTrigger?.focus();
  }
}

// Bind click event to Book a Demo links and Get Started in header
const bookDemoLinks = document.querySelectorAll('a');
bookDemoLinks.forEach(link => {
  const text = link.textContent.toLowerCase().trim();
  if (text.includes("book a demo") || (link.closest('.site-header') && text.includes("get started"))) {
    link.addEventListener("click", openModal);
  }
});

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", closeModal);
}

// Close modal when clicking overlay backdrop
if (demoModal) {
  demoModal.addEventListener("click", (e) => {
    if (e.target === demoModal) {
      closeModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && demoModal?.classList.contains("is-open")) closeModal();
});

// Form submit handler inside modal
if (demoBookingForm) {
  demoBookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitBtn = demoBookingForm.querySelector(".btn-submit");
    const originalText = submitBtn ? submitBtn.innerHTML : "Book a Demo";
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Booking…";
    }
    if (bookingStatus) {
      bookingStatus.textContent = "";
      bookingStatus.className = "form-status";
    }
    
    const payload = {
      firstName: document.getElementById("modal-first-name").value,
      lastName: document.getElementById("modal-last-name").value,
      email: document.getElementById("modal-email").value,
      suitableDate: document.getElementById("modal-date").value,
      suitableTime: document.getElementById("modal-time").value
    };
    
    try {
      const response = await fetch(getBookingApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.detail || "We couldn’t schedule your demo. Please try again.");
      }
      const data = await response.json();
      demoBookingForm.reset();
      if (modalDate) modalDate.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
      if (bookingStatus) {
        bookingStatus.textContent = data.message || "You’re booked! Please check your email for confirmation.";
        bookingStatus.className = "form-status is-success";
      }
    } catch (error) {
      console.error("Booking error:", error);
      if (bookingStatus) {
        bookingStatus.textContent = error.message;
        bookingStatus.className = "form-status is-error";
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  });
}

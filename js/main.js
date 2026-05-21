(function () {
  "use strict";

  const SPLASH_MS = {
    colors: 600,
    colorsPeak: 2000,
    brand: 2800,
    tagline: 3600,
    reveal: 5000,
    done: 6000,
  };

  const SPLASH_SEEN_KEY = "ztech-splash-seen";

  const splashAlreadySeen = () => {
    try {
      return sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
    } catch {
      return false;
    }
  };

  const markSplashSeen = () => {
    try {
      sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    } catch {
      /* private mode / blocked storage */
    }
  };

  const SPLASH_MESSAGES = [
    ["Z-TECH — ваш надёжный партнёр в цифре.", "Прямой контракт · production-grade."],
    ["Z-TECH — ваш надёжный друг в продакшене.", "Сайты, CRM и инфраструктура без посредников."],
    ["Z-TECH всегда на связи.", "Каждая заявка под контролем — от аудита до релиза."],
    ["Z-TECH — цифровая империя для вашего бизнеса.", "Скорость, безопасность, один контур ответственности."],
  ];

  const COMPARE_DATA = {
    constructors: [
      {
        title: "Медленная скорость",
        text: "Тяжёлые шаблоны и плагины — LCP 3–6 сек, клиент уходит с мобильного.",
      },
      {
        title: "Уязвимости и обновления",
        text: "Общие CMS-плагины — частая цель атак; патчи зависят от сторонних разработчиков.",
      },
      {
        title: "Падения на пике",
        text: "Всплеск заявок валит shared-хостинг — сайт недоступен в самый важный момент.",
      },
    ],
    architecture: [
      {
        title: "Docker-контейнеризация",
        text: "Обновления без простоя — релизы без риска для воронки и продаж.",
      },
      {
        title: "PostgreSQL",
        text: "Надёжное хранение заявок, статусов лидов и отчётности для команды.",
      },
      {
        title: "Загрузка < 1 сек",
        text: "Core Web Vitals под mobile — быстрый первый экран и выше конверсия.",
      },
    ],
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const revealSiteChrome = () => {
    $$(".site-chrome").forEach((el) => {
      el.classList.remove("site-chrome--hidden");
      el.classList.add("site-chrome--revealing");
    });
  };

  const finishSplash = () => {
    markSplashSeen();
    const splash = $("#splash-preloader");
    document.body.classList.remove("splash-active");
    document.documentElement.classList.remove("splash-pending");
    $$(".site-chrome").forEach((el) => {
      el.classList.remove("site-chrome--hidden", "site-chrome--revealing");
    });
    splash?.remove();
    window.dispatchEvent(new CustomEvent("splash-complete"));
  };

  const initSplash = () => {
    const splash = $("#splash-preloader");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!splash || reducedMotion || splashAlreadySeen()) {
      finishSplash();
      return;
    }

    const tagline = SPLASH_MESSAGES[Math.floor(Math.random() * SPLASH_MESSAGES.length)];
    const line1 = $("#splash-tagline-1");
    const line2 = $("#splash-tagline-2");
    if (line1) line1.textContent = tagline[0];
    if (line2) line2.textContent = tagline[1];

    requestAnimationFrame(() => {
      splash.classList.add("is-visible", "phase-enter");
    });

    const schedule = (ms, fn) => window.setTimeout(fn, ms);
    const timers = [];

    timers.push(schedule(SPLASH_MS.colors, () => splash.classList.replace("phase-enter", "phase-colors")));
    timers.push(
      schedule(SPLASH_MS.colorsPeak, () => splash.classList.replace("phase-colors", "phase-colors-peak"))
    );
    timers.push(
      schedule(SPLASH_MS.brand, () => splash.classList.replace("phase-colors-peak", "phase-brand"))
    );
    timers.push(
      schedule(SPLASH_MS.tagline, () => splash.classList.replace("phase-brand", "phase-tagline"))
    );
    timers.push(
      schedule(SPLASH_MS.reveal, () => {
        splash.classList.replace("phase-tagline", "phase-fade");
        revealSiteChrome();
      })
    );
    timers.push(
      schedule(SPLASH_MS.done, () => {
        timers.forEach(clearTimeout);
        splash.classList.add("is-done");
        finishSplash();
      })
    );
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSplash);
  } else {
    initSplash();
  }

  const header = $("#site-header");
  const burger = $("#burger");
  const mobileMenu = $("#mobile-menu");
  const auditForm = $("#audit-form");
  const formError = $("#form-error");
  const formSuccess = $("#form-success");
  const auditSubmit = $("#audit-submit");

  if (header) {
    const onScroll = () => {
      header.classList.toggle("header-scrolled", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  burger?.addEventListener("click", () => {
    const open = burger.classList.toggle("is-active");
    burger.setAttribute("aria-expanded", String(open));
    mobileMenu?.classList.toggle("is-open", open);
  });

  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      burger?.classList.remove("is-active");
      burger?.setAttribute("aria-expanded", "false");
      mobileMenu?.classList.remove("is-open");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const CONTACT_FIELDS = {
    phone: { type: "tel", placeholder: "+7 (999) 000-00-00", autocomplete: "tel" },
    email: { type: "email", placeholder: "ваш@email.ru", autocomplete: "email" },
    telegram: { type: "text", placeholder: "@username или t.me/username", autocomplete: "off" },
    whatsapp: { type: "tel", placeholder: "+7 (999) 000-00-00", autocomplete: "tel" },
  };

  const CONTACT_HINTS = {
    phone: "Укажите номер — перезвоним в рабочее время.",
    email: "Ваш email для ответа. Наша почта: Z-TECH@MAIL.RU",
    telegram: "Ваш @username — напишем в Telegram.",
    whatsapp: "Номер WhatsApp для быстрой связи.",
  };

  const getSelectedContactMethod = () =>
    document.querySelector('input[name="contact-method"]:checked')?.value || "phone";

  const syncContactValueField = () => {
    const valueInput = $("#contact-value");
    const hint = $("#contact-hint");
    const method = getSelectedContactMethod();
    const cfg = CONTACT_FIELDS[method] || CONTACT_FIELDS.phone;
    if (valueInput) {
      valueInput.type = cfg.type;
      valueInput.placeholder = cfg.placeholder;
      valueInput.autocomplete = cfg.autocomplete;
    }
    if (hint) {
      hint.textContent = CONTACT_HINTS[method] || "";
    }
  };

  $$('input[name="contact-method"]').forEach((radio) => {
    radio.addEventListener("change", syncContactValueField);
  });
  syncContactValueField();

  const formatTelegramError = (data, status) => {
    const raw =
      data?.error ||
      data?.description ||
      data?.message ||
      (typeof data === "string" ? data : "");

    if (/unauthorized/i.test(raw) || status === 401) {
      return (
        "Telegram отклонил токен (Unauthorized). Проверьте bot_token в telegram.local.json — " +
        "создайте бота у @BotFather и скопируйте токен целиком."
      );
    }
    if (/chat not found/i.test(raw)) {
      return (
        "Чат не найден. Напишите боту /start в Telegram, затем укажите свой chat_id " +
        "(число из getUpdates)."
      );
    }
    if (/not configured|не настроен/i.test(raw)) {
      return raw;
    }
    if (/timed out|timeout|urlopen/i.test(raw)) {
      return (
        "Telegram не ответил вовремя. Проверьте интернет или VPN и отправьте снова. " +
        "Или напишите на Z-TECH@MAIL.RU / Telegram."
      );
    }
    return raw || "Не удалось отправить заявку. Перезапустите dev_server.py после настройки Telegram.";
  };

  const formatNetworkError = (err) => {
    const msg = String(err?.message || err || "");
    if (window.location.protocol === "file:") {
      return "Откройте сайт через сервер, не как файл. В терминале: ./scripts/start-dev.sh или docker compose up -d --build";
    }
    if (/load failed|failed to fetch|networkerror|network error/i.test(msg)) {
      return "Сервер не запущен. Включите Docker Desktop и выполните: docker compose up -d --build — или ./scripts/start-dev.sh";
    }
    return msg || "Не удалось отправить заявку.";
  };

  const sendToTelegram = async ({ url, name, website, contact_method, contact_value }) => {
    let response;
    try {
      response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Z-Tech-Client": "1",
        },
        body: JSON.stringify({
          url,
          name,
          website: website || "",
          contact_method,
          contact_value,
        }),
        credentials: "same-origin",
      });
    } catch (err) {
      throw new Error(formatNetworkError(err));
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(formatTelegramError(data, response.status));
    }
    return data;
  };

  auditForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (formError) {
      formError.classList.add("hidden");
      formError.textContent = "";
    }

    const url = $("#project-url")?.value?.trim() || "";
    const name = $("#contact-name")?.value?.trim() || "";
    const website = $("#website")?.value?.trim() || "";
    const contact_method = getSelectedContactMethod();
    const contact_value = $("#contact-value")?.value?.trim() || "";

    if (!url) {
      if (formError) {
        formError.textContent = "Укажите URL проекта";
        formError.classList.remove("hidden");
      }
      return;
    }
    if (!contact_value) {
      if (formError) {
        formError.textContent = "Укажите контакт для связи";
        formError.classList.remove("hidden");
      }
      return;
    }
    if (!$("#consent-pdn")?.checked) {
      if (formError) {
        formError.textContent = "Нужно согласие на обработку ПДн";
        formError.classList.remove("hidden");
      }
      return;
    }

    const prevLabel = auditSubmit?.textContent;
    if (auditSubmit) {
      auditSubmit.disabled = true;
      auditSubmit.textContent = "Отправка…";
    }

    try {
      await sendToTelegram({ url, name, website, contact_method, contact_value });
      auditForm.classList.add("hidden");
      formSuccess?.classList.remove("hidden");
      formSuccess?.focus();
    } catch (err) {
      if (formError) {
        formError.textContent = err.message || "Ошибка отправки";
        formError.classList.remove("hidden");
      }
    } finally {
      if (auditSubmit) {
        auditSubmit.disabled = false;
        auditSubmit.textContent = prevLabel || "Запустить экспресс-аудит";
      }
    }
  });

  const initReveal = () => {
    const revealEls = $$(".reveal");
    if (revealEls.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -48px 0px" }
      );
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    }
  };

  const initSectionFx = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    $$(".fx-stagger").forEach((group) => {
      if (reduced) {
        group.classList.add("is-staggered");
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-staggered");
            entry.target.querySelectorAll(".fx-stagger-item").forEach((item, i) => {
              item.style.setProperty("--stagger", `${i * 0.07}s`);
            });
            io.unobserve(entry.target);
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
      );
      io.observe(group);
    });

    if (!reduced) {
      $$(".fx-card").forEach((card) => {
        card.addEventListener(
          "mousemove",
          (e) => {
            const r = card.getBoundingClientRect();
            card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
            card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
          },
          { passive: true }
        );
        card.addEventListener(
          "mouseleave",
          () => {
            card.style.removeProperty("--mx");
            card.style.removeProperty("--my");
          },
          { passive: true }
        );
      });
    }

    $$(".fx-benefit-list").forEach((list) => {
      const host = list.closest(".reveal") || list;
      if (reduced) {
        list.classList.add("is-lit");
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            list.classList.add("is-lit");
            io.disconnect();
          }
        },
        { threshold: 0.25 }
      );
      io.observe(host);
    });

    const faqItems = $$(".fx-faq");
    faqItems.forEach((item) => {
      item.addEventListener("toggle", () => {
        if (!item.open) return;
        faqItems.forEach((other) => {
          if (other !== item && other.open) other.open = false;
        });
      });
    });
  };

  const initHeroFx = () => {
    const hero = $("#hero");
    const glow = $("#hero-glow");
    const sparksRoot = $("#hero-sparks");
    if (!hero) return;

    hero.classList.add("is-live");

    if (sparksRoot && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const count = window.innerWidth < 768 ? 18 : 32;
      for (let i = 0; i < count; i++) {
        const s = document.createElement("span");
        s.className = "hero-spark";
        s.style.left = `${Math.random() * 100}%`;
        s.style.top = `${55 + Math.random() * 40}%`;
        s.style.setProperty("--dur", `${3 + Math.random() * 4}s`);
        s.style.setProperty("--delay", `${Math.random() * 4}s`);
        if (Math.random() > 0.6) {
          s.style.background = "#fff";
          s.style.boxShadow = "0 0 6px rgba(255,255,255,0.6)";
        }
        sparksRoot.appendChild(s);
      }
    }

    if (glow && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hero.addEventListener(
        "mousemove",
        (e) => {
          const rect = hero.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          glow.style.transform = `translate(calc(-50% + ${x * 40}px), ${y * 24}px) scale(1.05)`;
        },
        { passive: true }
      );
      hero.addEventListener(
        "mouseleave",
        () => {
          glow.style.transform = "translateX(-50%) scale(1)";
        },
        { passive: true }
      );
    }
  };

  const animateStatCounter = (el, duration = 1400) => {
    const target = parseFloat(el.dataset.target || "0");
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = target * eased;
      el.textContent = value.toLocaleString("ru-RU", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const initHeroStats = () => {
    const grid = $("#hero-stats");
    if (!grid) return;

    const run = () => {
      grid.querySelectorAll(".stat-counter").forEach((el) => animateStatCounter(el));
      grid.classList.add("stat-grid-active");
    };

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            run();
            io.disconnect();
          }
        },
        { threshold: 0.35 }
      );
      io.observe(grid);
    } else {
      grid.querySelectorAll(".stat-counter").forEach((el) => {
        const target = parseFloat(el.dataset.target || "0");
        const decimals = parseInt(el.dataset.decimals || "0", 10);
        el.textContent = target.toLocaleString("ru-RU", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      });
    }
  };

  const bootMotion = () => {
    initReveal();
    initSectionFx();
    initHeroFx();
    initHeroStats();
  };

  if ($("#splash-preloader")) {
    window.addEventListener("splash-complete", bootMotion, { once: true });
  } else {
    bootMotion();
  }

  const compareToggle = $("#compare-toggle");
  const compareContent = $("#compare-content");
  const compareList = $("#compare-list");
  const compareLabels = $$(".compare-label");

  const renderCompare = (mode) => {
    if (!compareList) return;
    const isArchitecture = mode === "architecture";
    const items = COMPARE_DATA[mode] || COMPARE_DATA.architecture;

    compareList.innerHTML = items
      .map(
        (item) => `
      <li class="compare-item ${isArchitecture ? "compare-item-pro" : "compare-item-con"} flex gap-4 items-start">
        <span class="compare-icon ${isArchitecture ? "compare-icon-pro" : "compare-icon-con"}" aria-hidden="true">${isArchitecture ? "✓" : "✕"}</span>
        <div>
          <strong class="text-white text-sm">${item.title}</strong>
          <p class="text-xs text-neutral-500 mt-1">${item.text}</p>
        </div>
      </li>`
      )
      .join("");

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      compareList.querySelectorAll(".compare-item").forEach((el, i) => {
        el.style.animationDelay = `${i * 0.06}s`;
        el.classList.add("compare-item-enter");
      });
    }

    compareContent?.classList.toggle("compare-mode-architecture", isArchitecture);
    compareContent?.classList.toggle("compare-mode-constructors", !isArchitecture);
    compareToggle?.classList.toggle("is-on", isArchitecture);
    compareToggle?.setAttribute("aria-checked", String(isArchitecture));

    compareLabels.forEach((label) => {
      const side = label.getAttribute("data-side");
      label.classList.toggle("is-active", side === mode);
    });
  };

  let compareMode = "architecture";
  renderCompare(compareMode);

  compareToggle?.addEventListener("click", () => {
    compareMode = compareMode === "architecture" ? "constructors" : "architecture";
    renderCompare(compareMode);
  });

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const mobileCta = $("#mobile-cta");
  const contactSection = $("#contact");
  if (mobileCta && contactSection && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const hideNearContact = () => {
      const rect = contactSection.getBoundingClientRect();
      const near = rect.top < window.innerHeight * 0.55;
      mobileCta.classList.toggle("is-hidden-near-form", near);
    };
    hideNearContact();
    window.addEventListener("scroll", hideNearContact, { passive: true });
  }
})();

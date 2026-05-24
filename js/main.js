(function () {
  "use strict";

  const SPLASH_MS = {
    colors: 350,
    colorsPeak: 900,
    brand: 1400,
    tagline: 1800,
    reveal: 2400,
    done: 3000,
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

  const getScrollY = () => window.scrollY;
  const lerp = (a, b, t) => a + (b - a) * t;

  const revealSiteChrome = () => {
    $$(".site-chrome").forEach((el) => {
      el.classList.remove("site-chrome--hidden");
      el.classList.add("site-chrome--revealing");
    });
  };

  let splashTimers = [];

  const cancelSplashTimers = () => {
    splashTimers.forEach(clearTimeout);
    splashTimers = [];
  };

  const finishSplash = () => {
    cancelSplashTimers();
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

  const skipSplash = () => {
    const splash = $("#splash-preloader");
    if (!splash) {
      finishSplash();
      return;
    }
    cancelSplashTimers();
    revealSiteChrome();
    splash.classList.add("is-done");
    finishSplash();
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

    $("#splash-skip")?.addEventListener("click", skipSplash);

    requestAnimationFrame(() => {
      splash.classList.add("is-visible", "phase-enter");
    });

    const schedule = (ms, fn) => window.setTimeout(fn, ms);

    splashTimers.push(schedule(SPLASH_MS.colors, () => splash.classList.replace("phase-enter", "phase-colors")));
    splashTimers.push(
      schedule(SPLASH_MS.colorsPeak, () => splash.classList.replace("phase-colors", "phase-colors-peak"))
    );
    splashTimers.push(
      schedule(SPLASH_MS.brand, () => splash.classList.replace("phase-colors-peak", "phase-brand"))
    );
    splashTimers.push(
      schedule(SPLASH_MS.tagline, () => splash.classList.replace("phase-brand", "phase-tagline"))
    );
    splashTimers.push(
      schedule(SPLASH_MS.reveal, () => {
        splash.classList.replace("phase-tagline", "phase-fade");
        revealSiteChrome();
      })
    );
    splashTimers.push(
      schedule(SPLASH_MS.done, () => {
        cancelSplashTimers();
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
      header.classList.toggle("header-scrolled", getScrollY() > 24);
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
      const top = target.getBoundingClientRect().top + getScrollY();
      target.scrollIntoView({ behavior: "auto", block: "start" });
    });
  });

  const CONTACT_FIELDS = {
    phone: { type: "tel", placeholder: "+7 (999) 000-00-00", autocomplete: "tel", inputMode: "tel" },
    email: {
      type: "text",
      placeholder: "name@example.com",
      autocomplete: "email",
      inputMode: "email",
      spellcheck: false,
    },
    telegram: { type: "text", placeholder: "@username или t.me/username", autocomplete: "off", inputMode: "text" },
    whatsapp: { type: "tel", placeholder: "+7 (999) 000-00-00", autocomplete: "tel", inputMode: "tel" },
  };

  const EMAIL_RE =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  const EMAIL_TYPO_TLD_HINTS = {
    con: ".com",
    comm: ".com",
    coom: ".com",
    cmo: ".com",
    comn: ".com",
    cpm: ".com",
    vom: ".com",
    xom: ".com",
    ruu: ".ru",
    rru: ".ru",
    nett: ".net",
    ner: ".net",
    orgg: ".org",
    ogr: ".org",
  };
  const EMAIL_BLOCKED_TLDS = new Set(["loc", "local", "test", "example", "invalid", "localhost"]);
  const EMAIL_DOMAIN_TYPOS = new Set([
    "gmial.com",
    "gmai.com",
    "gmal.com",
    "gmil.com",
    "gnail.com",
    "yandex.rf",
    "yndex.ru",
    "mail.rf",
    "inbox.rf",
  ]);

  const validateEmail = (raw) => {
    const email = String(raw || "").trim();
    if (!email) return "Укажите email";
    if (email.length > 254) return "Email слишком длинный";
    if (email.includes("..") || email.startsWith(".") || email.includes("@.") || email.includes(".@")) {
      return "Некорректный email";
    }
    if ((email.match(/@/g) || []).length !== 1) return "Некорректный email";
    if (!EMAIL_RE.test(email)) return "Некорректный email";

    const [local, domain] = email.split("@");
    if (local.length > 64 || domain.length > 253) return "Некорректный email";

    const domainLower = domain.toLowerCase();
    if (EMAIL_DOMAIN_TYPOS.has(domainLower)) {
      return "Проверьте написание домена почты (например gmail.com, yandex.ru)";
    }

    const labels = domainLower.split(".");
    const tld = labels[labels.length - 1];
    if (labels.length < 2 || tld.length < 2) {
      return "Укажите полный домен почты (например name@mail.ru)";
    }
    if (!/^[a-z]+$/i.test(tld)) {
      return "Домен почты должен заканчиваться на буквы (.ru, .com и т.д.)";
    }
    if (EMAIL_BLOCKED_TLDS.has(tld)) return "Некорректный домен email";
    if (EMAIL_TYPO_TLD_HINTS[tld]) {
      const hint = EMAIL_TYPO_TLD_HINTS[tld];
      return `Похоже на опечатку в домене: проверьте окончание ${hint} (не .${tld})`;
    }
    for (const label of labels) {
      if (!label || label.length > 63 || label.startsWith("-") || label.endsWith("-")) {
        return "Некорректный домен email";
      }
    }
    return null;
  };

  const validatePhone = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return "Некорректный номер телефона";
    return null;
  };

  const validateTelegram = (raw) => {
    const handle = String(raw || "")
      .trim()
      .replace(/^@/, "")
      .split("/")
      .pop();
    if (!handle || handle.length < 3) return "Укажите @username или ссылку t.me/...";
    return null;
  };

  const validateContactValue = (method, value) => {
    const v = String(value || "").trim();
    if (!v) return "Укажите контакт для связи";
    if (v.length > 120) return "Контакт слишком длинный";
    if (method === "email") return validateEmail(v);
    if (method === "phone" || method === "whatsapp") return validatePhone(v);
    if (method === "telegram") return validateTelegram(v);
    return null;
  };

  const CONTACT_HINTS = {
    phone: "Укажите номер — перезвоним в рабочее время.",
    email: "Ваш email для ответа. Наша почта: skskxnddndnx@inbox.ru",
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
      if (cfg.inputMode) valueInput.inputMode = cfg.inputMode;
      else valueInput.removeAttribute("inputmode");
      if (cfg.spellcheck === false) valueInput.spellcheck = false;
      else valueInput.removeAttribute("spellcheck");
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
        "Или напишите на skskxnddndnx@inbox.ru / Telegram."
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

  const sendToTelegram = async ({ url, name, website, contact_method, contact_value, budget }) => {
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
          budget: budget || "",
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
    const budget =
      document.querySelector('input[name="project-budget"]:checked')?.value?.trim() || "";

    if (!url) {
      if (formError) {
        formError.textContent = "Укажите URL проекта";
        formError.classList.remove("hidden");
      }
      return;
    }
    const contactErr = validateContactValue(contact_method, contact_value);
    if (contactErr) {
      if (formError) {
        formError.textContent = contactErr;
        formError.classList.remove("hidden");
      }
      $("#contact-value")?.focus();
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
      await sendToTelegram({ url, name, website, contact_method, contact_value, budget });
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
      const count = window.innerWidth < 768 ? 10 : 22;
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

  const initPremiumFx = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const progress = $("#scroll-progress");

    if (progress && !reduced) {
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? getScrollY() / max : 0;
        progress.style.transform = `scaleX(${Math.min(1, p)})`;
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const bindTilt = (el, max = 10) => {
      if (!el || reduced) return;
      el.addEventListener(
        "mousemove",
        (e) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          el.style.setProperty("--ry", `${x * max}deg`);
          el.style.setProperty("--rx", `${-y * max * 0.6}deg`);
        },
        { passive: true }
      );
      el.addEventListener(
        "mouseleave",
        () => {
          el.style.removeProperty("--ry");
          el.style.removeProperty("--rx");
        },
        { passive: true }
      );
    };

    $$("[data-tilt]").forEach((el) => bindTilt(el, el.classList.contains("browser-frame--lg") ? 6 : 12));

    if (!reduced) {
      $$(".btn-magnetic").forEach((btn) => {
        btn.addEventListener(
          "mousemove",
          (e) => {
            const r = btn.getBoundingClientRect();
            const x = e.clientX - r.left - r.width / 2;
            const y = e.clientY - r.top - r.height / 2;
            btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
          },
          { passive: true }
        );
        btn.addEventListener(
          "mouseleave",
          () => {
            btn.style.transform = "";
          },
          { passive: true }
        );
      });
    }
  };

  const initHeroRotator = () => {
    const el = $("#hero-rotator");
    if (!el) return;

    const phrases = [
      "сайт под ключ",
      "Telegram-CRM",
      "контур 152-ФЗ",
      "B2B-продакшен",
    ];
    let idx = 0;

    const cycle = () => {
      el.classList.add("is-out");
      window.setTimeout(() => {
        idx = (idx + 1) % phrases.length;
        el.textContent = phrases[idx];
        el.classList.remove("is-out");
      }, 380);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    window.setInterval(cycle, 3200);
  };

  const initUplabCursor = () => {
    const root = document.body;
    const wrap = $("#uplab-cursor");
    const glass = $("#uplab-cursor-glass");
    const dot = $("#uplab-cursor-dot");
    if (!wrap || !glass || !dot) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    root.classList.add("cursor-uplab");

    let dotX = window.innerWidth / 2;
    let dotY = window.innerHeight / 2;
    let glassX = dotX;
    let glassY = dotY;
    let tx = dotX;
    let ty = dotY;
    let angle = -24;
    let idleTimer = null;

    const placeDot = (x, y) => {
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const placeGlass = (x, y, rot) => {
      glass.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
    };

    placeDot(dotX, dotY);
    placeGlass(glassX, glassY, angle);

    const resetIdle = () => {
      root.classList.remove("is-cursor-idle");
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => root.classList.add("is-cursor-idle"), 1400);
    };

    const tick = () => {
      const prevX = glassX;
      const prevY = glassY;
      dotX = lerp(dotX, tx, 0.55);
      dotY = lerp(dotY, ty, 0.55);
      glassX = lerp(glassX, tx, 0.22);
      glassY = lerp(glassY, ty, 0.22);
      const vx = glassX - prevX;
      const vy = glassY - prevY;
      if (Math.abs(vx) + Math.abs(vy) > 0.08) {
        angle = lerp(angle, Math.atan2(vy, vx) * (180 / Math.PI) + 90, 0.12);
      }
      placeDot(dotX, dotY);
      placeGlass(glassX, glassY, angle);
      requestAnimationFrame(tick);
    };
    tick();

    document.addEventListener(
      "mousemove",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        resetIdle();
      },
      { passive: true }
    );

    const hoverSel =
      "a, button, .btn-primary, .btn-ghost, .btn-magnetic, input, textarea, select, summary, [data-cursor-hover]";
    document.addEventListener(
      "mouseover",
      (e) => {
        root.classList.toggle("is-cursor-hover", Boolean(e.target.closest(hoverSel)));
      },
      { passive: true }
    );
    document.addEventListener("mousedown", () => root.classList.add("is-cursor-down"), {
      passive: true,
    });
    document.addEventListener("mouseup", () => root.classList.remove("is-cursor-down"), {
      passive: true,
    });
    document.addEventListener("mouseleave", () => root.classList.add("is-cursor-hidden"));
    document.addEventListener("mouseenter", () => {
      root.classList.remove("is-cursor-hidden");
      resetIdle();
    });
    resetIdle();
  };

  const HERO_GLASS_LABELS = {
    cursor: "курсор",
    triangle: "треугольник",
    ring: "кольцо",
    hex: "гексагон",
    diamond: "ромб",
    cube: "куб",
  };

  const initHeroGlassProp = () => {
    const prop = $("#hero-glass-prop-inner");
    const shell = $("#hero-glass-prop");
    const hero = $("#hero");
    const modelsWrap = $("#hero-glass-models");
    const labelEl = $("#hero-glass-label");
    if (!prop || !hero) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const models = modelsWrap ? $$(".hero-glass-model", modelsWrap) : [];

    if (models.length > 1 && !reduced) {
      let modelIdx = 0;
      const setLabel = (model) => {
        if (!labelEl || !model) return;
        labelEl.textContent = HERO_GLASS_LABELS[model.dataset.model] || model.dataset.model || "";
      };
      setLabel(models[0]);

      window.setInterval(() => {
        const current = models[modelIdx];
        const nextIdx = (modelIdx + 1) % models.length;
        const next = models[nextIdx];
        current.classList.remove("is-active");
        current.classList.add("is-out");
        next.classList.add("is-active");
        setLabel(next);
        window.setTimeout(() => current.classList.remove("is-out"), 700);
        modelIdx = nextIdx;
      }, 3200);
    }

    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;

    const tick = () => {
      px = lerp(px, tx, 0.06);
      py = lerp(py, ty, 0.06);
      const scrollLift = getScrollY() * 0.08;
      prop.style.transform = `translate3d(${px * 18}px, ${py * 14}px, 0) rotate(${-14 + px * 5}deg)`;
      if (shell) {
        shell.style.transform = `translate3d(${px * -12}px, ${scrollLift * 0.35 + py * 8}px, 0)`;
      }
      requestAnimationFrame(tick);
    };
    tick();

    hero.addEventListener(
      "mousemove",
      (e) => {
        const r = hero.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
      },
      { passive: true }
    );
  };

  const initScrollParallax = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const layers = [{ el: $("#hero-showcase"), factor: 0.02 }].filter((l) => l.el);

    const update = () => {
      const y = getScrollY();
      layers.forEach(({ el, factor }) => {
        el.style.transform = `translate3d(0, ${y * factor}px, 0)`;
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
  };

  const initLinearFx = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spot = $("#linear-spotlight");
    const beams = $$(".linear-beam");

    if (spot && !reduced) {
      let sx = 50;
      let sy = 30;
      const lerp = (a, b, t) => a + (b - a) * t;
      let tx = 50;
      let ty = 30;
      const tick = () => {
        sx = lerp(sx, tx, 0.08);
        sy = lerp(sy, ty, 0.08);
        spot.style.setProperty("--spot-x", `${sx}%`);
        spot.style.setProperty("--spot-y", `${sy}%`);
        requestAnimationFrame(tick);
      };
      tick();
      document.addEventListener(
        "mousemove",
        (e) => {
          tx = (e.clientX / window.innerWidth) * 100;
          ty = (e.clientY / window.innerHeight) * 100;
        },
        { passive: true }
      );
    }

    if (!reduced && beams.length) {
      let angle = 0;
      const spin = () => {
        angle = (angle + 0.35) % 360;
        beams.forEach((b) => b.style.setProperty("--beam-angle", `${angle}deg`));
        requestAnimationFrame(spin);
      };
      spin();
    }
  };

  const bootMotion = () => {
    initReveal();
    initSectionFx();
    initHeroFx();
    initHeroStats();
    initPremiumFx();
    initLinearFx();
    initHeroRotator();
    initUplabCursor();
    initHeroGlassProp();
    initScrollParallax();
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
  const fabStack = $("#fab-stack");
  if (contactSection) {
    const hideNearContact = () => {
      const rect = contactSection.getBoundingClientRect();
      const near = rect.top < window.innerHeight * 0.55;
      mobileCta?.classList.toggle("is-hidden-near-form", near);
      fabStack?.classList.toggle("is-hidden-near-form", near);
    };
    hideNearContact();
    window.addEventListener("scroll", hideNearContact, { passive: true });
  }

  const syncDecorPause = () => {
    document.documentElement.classList.toggle("fx-paused", document.hidden);
  };
  document.addEventListener("visibilitychange", syncDecorPause);
  syncDecorPause();
})();

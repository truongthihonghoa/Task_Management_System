import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { EN_TO_VI, VI_TO_EN } from "../i18n/translations";

const LANGUAGE_STORAGE_KEY = "taskflow-language";
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";
const ACCESS_TOKEN_KEYS = ["access_token", "accessToken", "token", "auth_token"];
const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
});

const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];
const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
const EN_TO_VI_MONTHS = {
  Jan: "Thg 1",
  January: "Tháng 1",
  Feb: "Thg 2",
  February: "Tháng 2",
  Mar: "Thg 3",
  March: "Tháng 3",
  Apr: "Thg 4",
  April: "Tháng 4",
  May: "Tháng 5",
  Jun: "Thg 6",
  June: "Tháng 6",
  Jul: "Thg 7",
  July: "Tháng 7",
  Aug: "Thg 8",
  August: "Tháng 8",
  Sep: "Thg 9",
  September: "Tháng 9",
  Oct: "Thg 10",
  October: "Tháng 10",
  Nov: "Thg 11",
  November: "Tháng 11",
  Dec: "Thg 12",
  December: "Tháng 12",
};
const VI_TO_EN_MONTHS = Object.fromEntries(
  Object.entries(EN_TO_VI_MONTHS).map(([english, vietnamese]) => [vietnamese, english])
);

function translateDateMonths(value, language) {
  if (!/\d/.test(value)) return value;
  if (language === "vi") {
    return value.replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g,
      (month) => EN_TO_VI_MONTHS[month] || month
    );
  }
  return value.replace(/\b(Thg|Tháng)\s+(1[0-2]|[1-9])\b/g, (month) => VI_TO_EN_MONTHS[month] || month);
}

function translateValue(value, language) {
  if (!value || typeof value !== "string") return value;
  const dictionary = language === "vi" ? EN_TO_VI : VI_TO_EN;
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const core = value.trim().replace(/\s+/g, " ");
  const exactTranslation = dictionary[core];
  if (exactTranslation) return `${leading}${exactTranslation}${trailing}`;

  const colonLabelMatch = core.match(/^(.+?:)\s+(.+)$/);
  if (colonLabelMatch && dictionary[colonLabelMatch[1]]) {
    return `${leading}${dictionary[colonLabelMatch[1]]} ${colonLabelMatch[2]}${trailing}`;
  }

  const countMembersMatch = core.match(/^(\d+)\s+(members|thành viên)$/);
  if (countMembersMatch && dictionary[countMembersMatch[2]]) {
    return `${leading}${countMembersMatch[1]} ${dictionary[countMembersMatch[2]]}${trailing}`;
  }

  const compactAgoMatch = core.match(/^(\d+)(H|D)\s+AGO$/);
  if (language === "vi" && compactAgoMatch) {
    const unit = compactAgoMatch[2] === "H" ? "GIỜ" : "NGÀY";
    return `${leading}${compactAgoMatch[1]} ${unit} TRƯỚC${trailing}`;
  }

  const viCompactAgoMatch = core.match(/^(\d+)\s+(GIỜ|NGÀY)\s+TRƯỚC$/);
  if (language !== "vi" && viCompactAgoMatch) {
    const unit = viCompactAgoMatch[2] === "GIỜ" ? "H" : "D";
    return `${leading}${viCompactAgoMatch[1]}${unit} AGO${trailing}`;
  }

  const monthTranslation = translateDateMonths(core, language);
  if (monthTranslation !== core) return `${leading}${monthTranslation}${trailing}`;

  const phraseTranslation = Object.entries(dictionary)
    .filter(([source]) => source.length >= 8 && core.includes(source))
    .sort(([a], [b]) => b.length - a.length)
    .reduce((text, [source, target]) => text.split(source).join(target), core);

  return phraseTranslation !== core ? `${leading}${phraseTranslation}${trailing}` : value;
}

function shouldTranslateTextNode(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest("[data-i18n-skip='true']")) return false;
  return !IGNORED_TAGS.has(parent.tagName);
}

function translateElementAttributes(element, language) {
  TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
    if (!element.hasAttribute(attribute)) return;
    const currentValue = element.getAttribute(attribute);
    const nextValue = translateValue(currentValue, language);
    if (nextValue !== currentValue) {
      element.setAttribute(attribute, nextValue);
    }
  });
}

function translateNode(node, language) {
  if (!node) return;

  if (node.nodeType === Node.TEXT_NODE) {
    if (!shouldTranslateTextNode(node)) return;
    const nextValue = translateValue(node.nodeValue, language);
    if (nextValue !== node.nodeValue) {
      node.nodeValue = nextValue;
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node;
  if (element.closest("[data-i18n-skip='true']") || IGNORED_TAGS.has(element.tagName)) return;

  translateElementAttributes(element, language);
  element.childNodes.forEach((child) => translateNode(child, language));
}

function translateDocument(language) {
  if (typeof document === "undefined" || !document.body) return;
  translateNode(document.body, language);
  document.documentElement.lang = language === "vi" ? "vi" : "en";
}

function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  for (const key of ACCESS_TOKEN_KEYS) {
    const token = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (token) return token;
  }
  return null;
}

async function persistLanguagePreference(language) {
  const token = getStoredAccessToken();
  if (!token) return;

  try {
    await fetch(`${API_BASE_URL}/main-layout/preferences/language`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ language }),
    });
  } catch {
    // Keep the UI language responsive even if the API is temporarily unavailable.
  }
}

async function loadLanguagePreference() {
  const token = getStoredAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/main-layout/preferences`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.language === "vi" ? "vi" : "en";
  } catch {
    return null;
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
  });

  const setLanguage = (nextLanguage) => {
    const normalizedLanguage = nextLanguage === "vi" ? "vi" : "en";
    setLanguageState(normalizedLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
    }
    persistLanguagePreference(normalizedLanguage);
  };

  useEffect(() => {
    let isMounted = true;
    loadLanguagePreference().then((preferredLanguage) => {
      if (!isMounted || !preferredLanguage) return;
      setLanguageState(preferredLanguage);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, preferredLanguage);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    translateDocument(language);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          translateNode(mutation.target, language);
        }
        mutation.addedNodes.forEach((node) => translateNode(node, language));
        if (mutation.type === "attributes") {
          translateNode(mutation.target, language);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
    });

    return () => observer.disconnect();
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

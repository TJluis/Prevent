let chatBound = false;
let chatOnSubmit = () => {};

export function setupChatUI(onSubmit) {
  chatOnSubmit = onSubmit;
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const toggle = document.getElementById("chat-toggle");
  const body = document.getElementById("chat-body");

  let collapsed = true;

  const applyCollapsed = (next) => {
    collapsed = next;
    body.hidden = collapsed;
    if (toggle) {
      toggle.textContent = collapsed ? "💬" : "▾";
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.setAttribute("aria-label", collapsed ? "Abrir chat" : "Cerrar chat");
    }
    document.body.classList.toggle("chat-open", !collapsed);
    if (!collapsed) window.dispatchEvent(new CustomEvent("clubpingui:chat-open"));
  };

  if (!chatBound) {
    chatBound = true;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      chatOnSubmit(text);
      input.value = "";
    });

    if (toggle) {
      toggle.addEventListener("click", () => {
        applyCollapsed(!collapsed);
        if (!collapsed) input.focus();
      });
    }
  }

  applyCollapsed(collapsed);

  function formatTime(time) {
    const date = new Date(time || Date.now());
    const now = new Date();

    const hm = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) return `${hm} `;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `ayer ${hm} `;

    return `${date.getDate()}/${date.getMonth() + 1} ${hm} `;
  }

  return {
    clear() {
      log.innerHTML = "";
      input.value = "";
    },
    open() {
      applyCollapsed(false);
      input.focus();
    },
    close() {
      applyCollapsed(true);
    },
    isOpen() {
      return !collapsed;
    },
    focus() {
      input.focus();
    },
    blur() {
      input.blur();
    },
    isFocused() {
      return document.activeElement === input;
    },
    divider(label) {
      const div = document.createElement("div");
      div.className = "chat-divider";
      div.textContent = label;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    },
    appendMessage({ name, color = "#8b93a7", text, time, own = false }) {
      const line = document.createElement("div");
      line.className = "chat-line" + (own ? " chat-own" : "");

      const meta = document.createElement("span");
      meta.className = "chat-meta";
      meta.textContent = formatTime(time);

      const author = document.createElement("span");
      author.className = "chat-author";
      author.style.color = color;
      author.textContent = own ? "Tú" : name;

      const body = document.createElement("span");
      body.className = "chat-body";
      body.textContent = `: ${text}`;

      line.append(meta, author, body);
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    },
    system(text) {
      const line = document.createElement("div");
      line.className = "chat-line chat-system";
      line.textContent = text;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    },
  };
}
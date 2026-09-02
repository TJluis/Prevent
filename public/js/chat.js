export function setupChatUI(onSubmit) {
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    onSubmit(text);
    input.value = "";
  });

  return {
    clear() {
      log.innerHTML = "";
      input.value = "";
    },
    appendMessage({ name, color = "#8b93a7", text, time }) {
      const line = document.createElement("div");
      line.className = "chat-line";

      const meta = document.createElement("span");
      meta.className = "chat-meta";
      const date = new Date(time || Date.now());
      meta.textContent = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")} `;

      const author = document.createElement("span");
      author.className = "chat-author";
      author.style.color = color;
      author.textContent = name;

      const body = document.createElement("span");
      body.className = "chat-body";
      body.textContent = `: ${text}`;

      line.append(meta, author, body);
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    },
  };
}
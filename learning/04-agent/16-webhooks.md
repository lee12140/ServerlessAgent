# Module 16: The Encapsulated Web Component 🧬🛡️

## What You'll Build
A private, isolated chat interface that you can drop into **any** website with a single line of code. 

To ensure your agent doesn't "mess up" your website's styles (or vice versa), we're using **Shadow DOM**. 

---

## ✏️ Step 1: Enable CORS in AWS

Your browser will block requests to your AWS API unless you allow them.

Open `infra/lib/api-stack.ts` and update the `HttpApi` configuration:

```typescript
this.api = new apigateway.HttpApi(this, 'ServerlessAgentApi', {
  corsPreflight: {
    allowMethods: [apigateway.CorsHttpMethod.POST, apigateway.CorsHttpMethod.OPTIONS],
    allowOrigins: ['*'], // For production, replace with your specific website domain
    allowHeaders: ['content-type'],
  },
});
```

---

## ✏️ Step 2: Create the Web Component

Create `ui/agent-chat.js`. This file defines a custom HTML element `<agent-chat>`.

**Key Feature:** The `attachShadow({ mode: 'open' })` line creates a private playground for our CSS.

```javascript
class AgentChat extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // 🛡️ Encapsulation starts here
    }

    connectedCallback() {
        const apiUrl = this.getAttribute('url');
        const sessionId = localStorage.getItem('agent_sid') || Math.random().toString(36).substring(7);
        localStorage.setItem('agent_sid', sessionId);

        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; position: fixed; bottom: 20px; right: 20px; width: 350px; z-index: 9999; }
                .chat-box { 
                    background: rgba(30, 39, 46, 0.8); backdrop-filter: blur(15px);
                    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px;
                    display: flex; flex-direction: column; height: 450px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    font-family: sans-serif; color: white;
                }
                #messages { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
                .msg { padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.1); max-width: 80%; }
                .user { align-self: flex-end; background: #6c5ce7; }
                .input-area { padding: 10px; display: flex; gap: 8px; border-top: 1px solid rgba(255,255,255,0.1); }
                input { flex: 1; background: transparent; border: none; color: white; outline: none; }
                button { background: #6c5ce7; border: none; color: white; border-radius: 5px; cursor: pointer; padding: 5px 10px; }
            </style>
            <div class="chat-box">
                <div id="messages"></div>
                <div class="input-area">
                    <input type="text" id="input" placeholder="Ask me anything...">
                    <button id="send">Send</button>
                </div>
            </div>
        `;

        const sendBtn = this.shadowRoot.getElementById('send');
        const input = this.shadowRoot.getElementById('input');
        
        sendBtn.onclick = async () => {
            const text = input.value;
            if(!text) return;
            input.value = '';
            this.addMessage(text, 'user');

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, sessionId })
            });
            const data = await res.json();
            this.addMessage(data.message, 'ai');
        };
    }

    addMessage(text, role) {
        const container = this.shadowRoot.getElementById('messages');
        const div = document.createElement('div');
        div.className = `msg ${role}`;
        div.innerText = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
}

customElements.define('agent-chat', AgentChat);
```

---

## ✏️ Step 3: Use it on Your Website

Simply include the script and the tag!

```html
<!-- 1. Include the component -->
<script src="path/to/agent-chat.js"></script>

<!-- 2. Use the tag -->
<agent-chat url="https://YOUR_API_GATEWAY_URL/webhook"></</agent-chat>
```

✅ **Done!** Because of the Shadow DOM, your website's CSS cannot change the chat-box's background, and the chat-box's styles cannot change your website's buttons. **Clean, safe, and professional.**

➡️ **Next: [Module 17 — Adding "Ears" (Audio Support)](./17-audio.md)**

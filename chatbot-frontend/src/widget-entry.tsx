import React from "react";
import { createRoot } from "react-dom/client";
import ChatWidget from "./widget/ChatWidget";
import { BASE_URL } from './api/client';
import { findWidgetMount, readWidgetRuntime } from './widget/widget-runtime';

const script = document.currentScript as HTMLScriptElement | null;
const config = (() => {
    try { return readWidgetRuntime(script, BASE_URL); }
    catch {
        console.warn('Chatbot widget configuration is invalid. Check data-site-id and data-api-url.');
        return null;
    }
})();
function mountWidget() {
    if (!config || findWidgetMount(document, config)) return;
    const root = document.createElement('div');
    let suffix = 1;
    let id = 'chatbot-widget-root';
    while (document.getElementById(id)) id = `chatbot-widget-root-${++suffix}`;
    root.id = id;
    root.dataset.chatbotWidgetMount = 'true';
    root.dataset.siteId = config.siteId;
    root.dataset.apiUrl = config.apiUrl;
    document.body.appendChild(root);
    createRoot(root).render(<React.StrictMode><ChatWidget siteId={config.siteId} apiUrl={config.apiUrl} /></React.StrictMode>);
}
if (document.body) mountWidget();
else document.addEventListener('DOMContentLoaded', mountWidget, { once: true });

/// <reference types="chrome" />
import { createBridgeWorker } from './bridgeWorker.ts';
const handle = createBridgeWorker(chrome);
chrome.runtime.onMessage.addListener((message, sender, reply) => { void handle(message, sender).then(reply); return true; });

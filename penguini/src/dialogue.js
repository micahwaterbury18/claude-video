// dialogue.js - the conversation box.
//
// It reads scenes out of data/scenes.json and nothing else. Writing new
// dialogue means editing that file; you never have to come in here.
//
// A scene is a bag of nodes. Each node shows some text and offers choices,
// each choice points at the next node, and some nodes end the scene. Choices
// can carry effects, which get handed to state.js.

import scenes from '../data/scenes.json';
import { createState } from './state.js';

const TYPE_SPEED = 18;   // milliseconds per character while text types on

function buildStyles() {
  if (document.getElementById('dialogue-style')) return;
  const style = document.createElement('style');
  style.id = 'dialogue-style';
  style.textContent = `
    #dialogue {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      z-index: 30;
      padding: 0 max(16px, env(safe-area-inset-left)) max(18px, env(safe-area-inset-bottom));
      display: flex;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      transform: translateY(14px);
      transition: opacity .28s ease, transform .28s ease;
    }
    #dialogue.on { opacity: 1; transform: none; }

    #dialogue .panel {
      pointer-events: auto;
      width: min(760px, 100%);
      background: rgba(8, 18, 31, 0.94);
      border: 1px solid rgba(63, 240, 194, 0.22);
      border-radius: 16px;
      padding: 20px 22px 18px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(6px);
    }

    #dialogue .speaker {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.22em;
      color: #3ff0c2;
      margin-bottom: 9px;
    }
    #dialogue .speaker.narration { color: rgba(234,244,255,.42); }

    #dialogue .text {
      font-size: clamp(15px, 2.4vw, 17px);
      line-height: 1.55;
      color: #eaf4ff;
      white-space: pre-wrap;
      min-height: 3.1em;
    }

    #dialogue .choices {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    #dialogue button {
      font: inherit;
      font-size: clamp(14px, 2.2vw, 15px);
      text-align: left;
      color: #eaf4ff;
      background: rgba(63, 240, 194, 0.07);
      border: 1px solid rgba(63, 240, 194, 0.30);
      border-radius: 10px;
      padding: 11px 14px;
      cursor: pointer;
      transition: background .14s ease, border-color .14s ease, transform .1s ease;
    }
    #dialogue button:hover {
      background: rgba(63, 240, 194, 0.16);
      border-color: rgba(63, 240, 194, 0.6);
    }
    #dialogue button:active { transform: scale(0.99); }

    #dialogue .continue {
      margin-top: 16px;
      text-align: center;
      font-size: 12px;
      letter-spacing: 0.2em;
      color: rgba(234,244,255,.45);
      cursor: pointer;
      pointer-events: auto;
      padding: 10px;
    }

    /* Little floating "+3 CRED" style notes when a choice changes something. */
    #dialogue .pops {
      position: absolute;
      right: 22px;
      top: -14px;
      display: flex;
      gap: 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .1em;
    }
    #dialogue .pop { animation: popfade 1.8s ease forwards; }
    @keyframes popfade {
      0%   { opacity: 0; transform: translateY(6px); }
      18%  { opacity: 1; transform: translateY(0); }
      75%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(-12px); }
    }
  `;
  document.head.appendChild(style);
}

const STAT_COLOURS = { cash: '#8ef0a8', heat: '#ff6b6b', cred: '#3ff0c2' };

/**
 * Create the dialogue system.
 *
 * @param {ReturnType<createState>} state
 * @param {{ onOpen?: Function, onClose?: Function }} hooks
 *        so the game can pause the controls while a conversation is up
 */
export function createDialogue(state, hooks = {}) {
  buildStyles();

  const root = document.createElement('div');
  root.id = 'dialogue';
  root.innerHTML = `
    <div class="panel">
      <div class="pops"></div>
      <div class="speaker"></div>
      <div class="text"></div>
      <div class="choices"></div>
      <div class="continue" hidden>CONTINUE</div>
    </div>`;
  document.body.appendChild(root);

  const els = {
    panel: root.querySelector('.panel'),
    pops: root.querySelector('.pops'),
    speaker: root.querySelector('.speaker'),
    text: root.querySelector('.text'),
    choices: root.querySelector('.choices'),
    continue: root.querySelector('.continue'),
  };

  let active = null;        // the scene being played
  let typing = null;        // the running "type it on" timer
  let typingDone = null;    // what to do once the line has finished appearing
  let fullText = '';

  function showPops(changes) {
    for (const [key, delta] of Object.entries(changes)) {
      if (key === 'flags' || typeof delta !== 'number' || delta === 0) continue;
      // Built and Took are hidden by design - the player never sees them move.
      if (key === 'built' || key === 'took') continue;
      const pop = document.createElement('span');
      pop.className = 'pop';
      pop.style.color = STAT_COLOURS[key] || '#eaf4ff';
      pop.textContent = `${delta > 0 ? '+' : ''}${delta} ${key.toUpperCase()}`;
      els.pops.appendChild(pop);
      setTimeout(() => pop.remove(), 1900);
    }
  }

  /** Type the text on, and let a tap skip straight to the end of it. */
  function setText(text, onDone) {
    clearInterval(typing);
    fullText = text;
    els.text.textContent = '';
    typingDone = onDone || null;
    let i = 0;
    typing = setInterval(() => {
      i += 1;
      els.text.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(typing);
        typing = null;
        const done = typingDone;
        typingDone = null;
        done?.();
      }
    }, TYPE_SPEED);
  }

  function finishTyping() {
    if (!typing) return false;
    clearInterval(typing);
    typing = null;
    els.text.textContent = fullText;
    const done = typingDone;
    typingDone = null;
    done?.();
    return true;
  }

  function renderNode(nodeId) {
    const node = active.scene.nodes[nodeId];
    if (!node) {
      console.error(`[dialogue] scene "${active.id}" has no node "${nodeId}"`);
      return close();
    }
    active.nodeId = nodeId;

    els.speaker.textContent = node.speaker || '';
    els.speaker.classList.toggle('narration', !node.speaker);
    els.speaker.style.display = node.speaker ? '' : 'none';

    els.choices.innerHTML = '';
    els.continue.hidden = true;

    if (node.end) {
      // Nodes can carry effects even with no choice attached.
      if (node.effects) showPops(state.apply(node.effects));
      // Only offer CONTINUE once the line has actually finished appearing -
      // otherwise the first tap silently eats the rest of the sentence.
      setText(node.text || '', () => { els.continue.hidden = false; });
      els.continue.onclick = () => { if (!finishTyping()) close(); };
      return;
    }

    setText(node.text || '');

    for (const choice of node.choices || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice.text;
      button.onclick = () => {
        // First tap finishes the typing rather than picking blind.
        if (finishTyping()) return;
        if (choice.effects) showPops(state.apply(choice.effects));
        renderNode(choice.goto);
      };
      els.choices.appendChild(button);
    }
  }

  function open(sceneId) {
    const scene = scenes.scenes[sceneId];
    if (!scene) {
      console.error(`[dialogue] no scene called "${sceneId}"`);
      return;
    }
    active = { id: sceneId, scene, nodeId: null };
    root.classList.add('on');
    hooks.onOpen?.(sceneId);
    renderNode(scene.start);
  }

  function close() {
    if (!active) return;
    const finished = active.id;
    state.markPlayed(finished);
    active = null;
    clearInterval(typing);
    typing = null;
    root.classList.remove('on');
    hooks.onClose?.(finished);
  }

  // Space or Enter also advances, for anyone playing at a desk.
  window.addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (finishTyping()) return;
      if (!els.continue.hidden) close();
    }
  });

  return {
    open,
    close,
    get isOpen() { return active !== null; },
    get scenes() { return scenes.scenes; },
  };
}

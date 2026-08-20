// state.js - everything the game remembers about Penguini.
//
// Three numbers you can see, two you can't, and a set of flags recording what
// has happened. All of it saves to the browser automatically, so closing the
// tab doesn't lose your game.

const SAVE_KEY = 'penguini.save.v1';

/** What a brand new game looks like. */
function freshState() {
  return {
    // --- the three on the HUD ---------------------------------------------
    cash: 0,      // dollars. Rent is due Friday.
    heat: 0,      // 0-100. How interested the Seals are in him.
    cred: 5,      // 0-100. Whether anyone takes him seriously.

    // --- the two he never sees --------------------------------------------
    // These decide the ending. Built goes up when he makes something or looks
    // after somebody; Took goes up when he takes a shortcut. The player is
    // never told these exist - they just find out at the end which one they
    // were actually doing.
    built: 0,
    took: 0,

    // --- what has happened -------------------------------------------------
    flags: {},          // e.g. { kickedOut: true, sawCindy: false }
    scenesPlayed: [],   // so a one-shot scene doesn't replay
    chapter: 1,
  };
}

export function createState() {
  let data = freshState();
  const listeners = new Set();

  function notify(changes) {
    for (const fn of listeners) fn(data, changes);
  }

  const api = {
    get data() { return data; },

    /** Be told whenever anything changes, so the HUD can update itself. */
    subscribe(fn) {
      listeners.add(fn);
      fn(data, {});
      return () => listeners.delete(fn);
    },

    /**
     * Apply the effects attached to a dialogue choice.
     *
     * Effects look like { cash: 40, heat: 5, flags: { kickedOut: true } }.
     * Anything missing is left alone.
     */
    apply(effects) {
      if (!effects) return {};
      const changes = {};

      for (const key of ['cash', 'heat', 'cred', 'built', 'took']) {
        if (typeof effects[key] !== 'number') continue;
        const before = data[key];
        let after = before + effects[key];
        // Heat and cred are percentages; cash can go anywhere but not below
        // zero, because he has no bank account to be overdrawn on.
        if (key === 'heat' || key === 'cred') after = Math.max(0, Math.min(100, after));
        if (key === 'cash') after = Math.max(0, after);
        data[key] = after;
        if (after !== before) changes[key] = after - before;
      }

      if (effects.flags) {
        Object.assign(data.flags, effects.flags);
        changes.flags = effects.flags;
      }

      api.save();
      notify(changes);
      return changes;
    },

    flag(name) { return !!data.flags[name]; },

    markPlayed(sceneId) {
      if (!data.scenesPlayed.includes(sceneId)) {
        data.scenesPlayed.push(sceneId);
        api.save();
      }
    },

    hasPlayed(sceneId) { return data.scenesPlayed.includes(sceneId); },

    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      } catch (err) {
        // Private browsing, or storage full. Not worth crashing a game over.
        console.warn('[penguini] could not save:', err.message);
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        // Merge onto a fresh state, so a save from an older version that's
        // missing newer fields still loads instead of breaking the game.
        data = { ...freshState(), ...JSON.parse(raw) };
        notify({});
        return true;
      } catch (err) {
        console.warn('[penguini] save was unreadable, starting fresh:', err.message);
        return false;
      }
    },

    reset() {
      data = freshState();
      api.save();
      notify({});
    },
  };

  return api;
}

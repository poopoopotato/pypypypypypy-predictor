// ==UserScript==
// @name         IdleLoops Predictor
// @namespace    https://github.com/Koviko/
// @version      1.1.1
// @description  Predicts the amount of resources spent and gained by each action in the action list. Valid as of IdleLoops v.77.
// @author       Koviko <koviko.net@gmail.com>
// @website      http://koviko.net/
// @match        http://stopsign.github.io/idleLoops/*
// @grant        none
// ==/UserScript==

/** @namespace */
const Koviko = {
  /**
   * IdleLoops view
   * @typedef {Object} Koviko~View
   * @prop {function} updateNextActions Method responsible for updating the view
   */

  /**
   * Represents an action in the action list
   * @typedef {Object} Koviko~ListedAction
   * @prop {string} name Name of the action
   * @prop {number} loops Number of loops to perform
   */

  /**
   * IdleLoops action
   * @typedef {Object} Koviko~Action
   * @prop {string} name Name of the action
   * @prop {number} expMult Experience multiplier (typically 1)
   * @prop {number} townNum The town to which the action belongs
   * @prop {string} varName The unique identifier used for variables in the `towns` array
   * @prop {number} [segments] Amount of segments per loop
   * @prop {number} [dungeonNum] The dungeon to which the action belongs
   * @prop {Object.<string, number>} stats Stats that affect and are affected by the action
   * @prop {Array.<string>} [loopStats] Stats used in the respective segment per loop
   * @prop {function} manaCost Mana cost to complete the action
   */

  /**
   * IdleLoops town, which includes total progression for all actions
   * @typedef {Object} Koviko~Town
   */

  /**
   * IdleLoops dungeon floor
   * @typedef {Object} Koviko~DungeonFloor
   * @prop {number} ssChance Chance to get a soulstone
   * @prop {number} completed Amount of times completed
   */

  /**
   * Globals
   * @prop {Koviko~View} view IdleLoops view object
   * @prop {Object} actions IdleLoops actions object
   * @prop {Array.<Koviko~ListedAction>} actions.next Action List
   * @prop {HTMLElement} nextActionsDiv Action list container
   * @prop {Array.<string>} statList Names of all stats
   * @prop {Array.<Koviko~Town>} towns Town objects
   * @prop {Array.<Array.<Koviko~DungeonFloor>>} dungeons Dungeon objects
   * @prop {function} fibonacci Calculates the value of the given index of the Fibonacci sequence
   * @prop {function} precision3 Rounds numbers to a precision of 3
   * @prop {function} translateClassNames Converts an action name to a {@link Koviko~Action} object
   * @prop {function} getSkillLevel Get the current level of a skill
   * @prop {function} getLevelFromExp Converts an amount of experience into a level
   * @prop {function} getTotalBonusXP Determine the current amount of bonus XP from talents and soulstones
   * @prop {function} getCraftGuildRank Calculate the craft guild rank and get an object with the rank name and experience bonus value
   * @prop {function} getAdvGuildRank Calculate the adventure guild rank and get an object with the rank name and experience bonus value
   * @prop {function} goldCostLocks Determine the amount of gold gained from lockpicking
   * @prop {function} goldCostSQuests Determine the amount of gold gained from short quests
   * @prop {function} goldCostLQuests Determine the amount of gold gained from long quests
   */
  globals: {
    view: null,
    actions: null,
    nextActionsDiv: null,
    statList: null,
    towns: null,
    dungeons: null,
    fibonacci: null,
    precision3: null,
    translateClassNames: null,
    getSkillLevel: null,
    getLevelFromExp: null,
    getTotalBonusXP: null,
    getCraftGuildRank: null,
    getAdvGuildRank: null,
    goldCostLocks: null,
    goldCostSQuests: null,
    goldCostLQuests: null,
  },

  /** A prediction, capable of calculating and estimating ticks and rewards of an action. */
  Prediction: class {
    /**
     * Loop attributes for a prediction
     * @typedef {Object} Koviko.Prediction~Loop
     * @prop {function} cost Cost to complete a segment
     * @prop {function} tick Amount of progress completed in one tick
     * @prop {Object} effect Effects at the end of a loop or segment
     * @prop {function} [effect.segment] Effect at the end of a segment
     * @prop {function} [effect.loop] Effect at the end of a loop
     */

    /**
     * Parameters to be passed to the Prediction constructor
     * @typedef {Object} Koviko.Prediction~Parameters
     * @prop {Array.<string>} affected Affected resources
     * @prop {function} effect Method that will mutate resources
     * @prop {Koviko.Prediction~Loop} loop Loop attributes
     */

    /**
     * Create the prediction
     * @param {string} name Name of the action
     * @param {Koviko.Prediction~Parameters} params Parameter object
     */
    constructor(name, params) {
      /**
       * Name of the action
       * @member {string}
       */
      this.name = name;

      /**
       * Action being estimated
       * @member {Koviko~Action}
       */
      this.action = Koviko.globals.translateClassNames(name);

      /**
       * The pre-calculated amount of ticks needed for the action to complete.
       * @member {number}
       */
      this._ticks = 0;

      /**
       * Resources affected by the action
       * @member {Array.<string>}
       */
      this.affected = params.affected || [];

      /**
       * Effect of the action.
       * @member {function|null}
       */
      this.effect = params.effect || null;

      /**
       * Effect(s) and tick calculations of the action's loops
       * @member {Koviko.Prediction~Loop|null}
       */
      this.loop = params.loop || null;
    }

    /**
     * Calculate the number of ticks needed to complete the action.
     * @param {Koviko.Prediction~Action} a Action object
     * @param {Predictor~Stats} s Accumulated stat experience
     * @memberof Koviko.Prediction
     */
    updateTicks(a, s) {
      let cost = Koviko.globals.statList.reduce((cost, i) => cost + (i in a.stats && i in s ? a.stats[i] / (1 + Koviko.globals.getLevelFromExp(s[i]) / 100) : 0), 0);
      return (this._ticks = Math.ceil(a.manaCost() * cost - .000001));
    }

    /**
     * Get the pre-calculated amount of ticks needed for the action to complete.
     * @memberof Koviko.Prediction
     */
    ticks() {
      return this._ticks || this.updateTicks();
    }

    /**
     * Add the experience gained in one tick to the accumulated stat experience.
     * @param {Koviko.Prediction~Action} a Action object
     * @param {Predictor~Stats} s Accumulated stat experience
     * @memberof Koviko.Prediction
     */
    exp(a, s) {
      Koviko.globals.statList.forEach(i => i in a.stats && i in s && (s[i] += a.stats[i] * a.expMult * (a.manaCost() / this.ticks()) * Koviko.globals.getTotalBonusXP(i)));
    }
  },

  /** A predictor which uses Predictions to calculate and estimate an entire action list. */
  Predictor: class {
    /**
     * Progression
     * @typedef {Object} Koviko.Predictor~Progression
     * @prop {number} completed The amount of total segments completed
     * @prop {number} progress The amount of progress in segments beyond that already represented in `completed`
     * @prop {number} total The amount of successful loops ever completed
     */

    /**
     * Accumulated stat experience
     * @typedef {Object.<string, number>} Koviko.Predictor~Stats
     */

    /**
     * Accumulated resources
     * @typedef {Object.<string, number>} Koviko.Predictor~Resources
     */

    /**
     * Accumulated progress
     * @typedef {Object.<string, Koviko.Predictor~Progression>} Koviko.Predictor~Progress
     */

    /**
     * State object
     * @typedef {Object} Koviko.Predictor~State
     * @prop {Koviko.Predictor~Stats} stats Accumulated stat experience
     * @prop {Koviko.Predictor~Resources} resources Accumulated resources
     * @prop {Koviko.Predictor~Progress} progress Accumulated progress
     */

    /**
     * Create the predictor
     * @param {Koviko~View} view IdleLoops view object
     * @param {Object} actions IdleLoops actions object
     * @param {Array.<Koviko~ListedAction>} actions.next Action List
     * @param {HTMLElement} container Action list container
     */
    constructor(view, actions, container) {
      // Initialization steps broken into pieces, for my sake
      this.initStyle();
      this.initElements()
      this.initPredictions();

      // Prepare `updateNextActions` to be hooked
      if (!view._updateNextActions) {
        view._updateNextActions = view.updateNextActions;
      }

      // Hook `updateNextActions` with the predictor's update function
      view.updateNextActions = () => {
        view._updateNextActions();
        this.update(actions.next, container);
      };

      view.updateNextActions();
    }

    /**
     * Run a fake action list containing every possible action so that, hopefully, every function is ran at least once.
     * @memberof Koviko.Predictor
     */
    test() {
      const actions = [];

      for (const name in this.predictions) {
        actions.push({ name: name, loops: 100 });
      }

      this.update(actions, null, true);
    }

    /**
     * Build the style element responsible for the formatting of the predictor's values.
     * @memberof Koviko.Predictor
     */
    initStyle() {
      // Get the style element if it already exists for some reason
      let style = document.getElementById('koviko');

      // Build the CSS
      let css = `
      .nextActionContainer{width:auto!important;padding:0 4px}
      span.koviko{font-weight:bold;color:#8293ff}
      ul.koviko{display:inline-block;list-style:none;margin:0;padding:0;pointer-events:none}
      ul.koviko li{display:inline-block;margin: 0 2px;font-weight:bold;font-size:90%}
      ul.koviko.invalid li{color:#c00!important}
      ul.koviko .mana{color:#8293ff}
      ul.koviko .gold{color:#d09249}
      ul.koviko .rep{color:#b06f37}
      ul.koviko .soul{color:#9d67cd}
      ul.koviko .herbs{color:#4caf50}
      ul.koviko .hide{color:#663300}
      ul.koviko .potions{color:#00b2ee}
      `;

      // Create the <style> element if it doesn't already exist
      if (!style || style.tagName.toLowerCase() !== 'style') {
        style = document.createElement('style');
        style.type = 'text/css';
        style.id = 'koviko';
        document.head.appendChild(style);
      }

      // Clean out the <style> element and append the correct CSS
      for (; style.lastChild; style.removeChild(style.lastChild));
      style.appendChild(document.createTextNode(css));
    }

    /**
     * Build the element that shows the total mana required by the action list.
     * @memberof Koviko.Predictor
     */
    initElements() {
      // Find the display element for the total if it already exists
      let parent = document.getElementById('actionList').firstElementChild;

      /**
       * Element that displays the total amount of mana used in the action list
       * @member {HTMLElement}
       */
      this.totalDisplay = [...parent.children].reduce((total, el, i, arr) => total || el.className === 'koviko' && el, false);

      // If the element doesn't already exist, create it
      if (!this.totalDisplay) {
        this.totalDisplay = document.createElement('span');
        this.totalDisplay.className = 'koviko';
        parent.appendChild(this.totalDisplay);
      }
    }

    /**
     * Build all of the necessary components to make predictions about each action.
     * @memberof Koviko.Predictor
     */
    initPredictions() {
      // Alias the globals to a shorter variable name
      const g = Koviko.globals;

      // Organize predictions to be passed to Prediction class
      /**
       * Prediction parameters
       * @type {Object.<string, Koviko.Prediction~Parameters>}
       */
      const predictions = {
        // Beginnersville
        'Wander': {},
        'Smash Pots': { affected: ['mana'], effect: r => r.mana += 100 },
        'Pick Locks': { affected: ['gold'], effect: r => r.gold += g.goldCostLocks() },
        'Buy Glasses': { effect: r => (r.gold -= 10, r.glasses = true) },
        'Buy Mana': { affected: ['mana', 'gold'], effect: r => (r.mana += r.gold * 50, r.gold = 0) },
        'Meet People': {},
        'Train Strength': {},
        'Short Quest': { affected: ['gold'], effect: r => r.gold += g.goldCostSQuests() },
        'Investigate': {},
        'Long Quest': { affected: ['gold', 'rep'], effect: r => (r.gold += g.goldCostLQuests(), r.rep += 1) },
        'Throw Party': { affected: ['rep'], effect: r => r.rep -= 2 },
        'Warrior Lessons': {},
        'Mage Lessons': {},
        'Buy Supplies': { affected: ['gold'], effect: r => (r.gold -= 300 - Math.max((r.supplyDiscount || 0) * 20, 0), r.supplies = (r.supplies || 0) + 1) },
        'Haggle': { effect: r => (r.rep--, r.supplyDiscount = (r.supplyDiscount || 0) + 1) },
        'Start Journey': { effect: r => r.supplies = (r.supplies || 0) - 1 },

        // Forest Path
        'Explore Forest': {},
        'Wild Mana': { affected: ['mana'], effect: r => r.mana += 250 },
        'Gather Herbs': { affected: ['herbs'], effect: r => r.herbs += 1 },
        'Hunt': { affected: ['hide'], effect: r => r.hide += 1 },
        'Sit By Waterfall': {},
        'Old Shortcut': {},
        'Talk To Hermit': {},
        'Practical Magic': {},
        'Learn Alchemy': { affected: ['herbs'], effect: r => r.herbs -= 10 },
        'Brew Potions': { affected: ['herbs', 'potions'], effect: r => (r.herbs -= 10, r.potions++) },
        'Train Dex': {},
        'Train Speed': {},
        'Continue On': {},

        // Merchanton
        'Explore City': {},
        'Gamble': { affected: ['gold', 'rep'], effect: r => (r.rep--, r.gold += 60 - 20) },
        'Get Drunk': { affected: ['rep'], effect: r => r.rep-- },
        'Purchase Mana': { affected: ['mana', 'gold'], effect: r => (r.mana += r.gold * 50, r.gold = 0) },
        'Sell Potions': { affected: ['gold', 'potions'], effect: r => (r.gold += r.potions * g.getSkillLevel('Alchemy'), r.potions--) },
        'Read Books': {},
        'Gather Team': { affected: ['gold'], effect: r => (r.gold -= (r.team || 0) * 200, r.team = (r.team || 0) + 1) },
        'Craft Armor': { affected: ['hide'], effect: r => (r.hide -= 2, r.armor = (r.armor || 0) + 1) },
        'Apprentice': {},
        'Mason': {},
        'Architect': {},

        // Basic loops
        'Heal The Sick': { affected: ['rep'], loop: {
          cost: (p, a) => segment => g.fibonacci(2 + Math.floor((p.completed + segment) / a.segments + .0000001)) * 5000,
          tick: (p, a, s) => offset => g.getSkillLevel('Magic') * Math.sqrt(1 + p.total / 100) * (1 + g.getLevelFromExp(s[a.loopStats[(p.completed + offset) % a.loopStats.length]]) / 100),
          effect: { loop: r => r.rep += 3 },
        }},
        'Fight Monsters': { affected: ['gold'], loop: {
          cost: (p, a) => segment => g.fibonacci(Math.floor((p.completed + segment) - p.completed / a.segments + .0000001)) * 10000,
          tick: (p, a, s) => offset => g.getSkillLevel('Combat') * Math.sqrt(1 + p.total / 100) * (1 + g.getLevelFromExp(s[a.loopStats[(p.completed + offset) % a.loopStats.length]]) / 100),
          effect: { segment: r => r.gold += 20 },
        }},
        'Adventure Guild': { affected: ['gold'], loop: {
          cost: (p) => segment => g.precision3(Math.pow(1.2, p.completed + segment)) * 5e6,
          tick: (p, a, s, r) => offset => {
            let selfCombat = g.getSkillLevel('Combat') * (1 + ((r.armor || 0) * g.getCraftGuildRank().bonus) / 5);
            return (g.getSkillLevel('Magic') / 2 + selfCombat)
              * (1 + g.getLevelFromExp(s[a.loopStats[(p.completed + offset) % a.loopStats.length]]) / 100)
              * Math.sqrt(1 + p.total / 1000);
          },
          effect: { segment: r => r.mana += 200 }
        }},
        'Crafting Guild': { affected: ['gold'], loop: {
          cost: (p) => segment => g.precision3(Math.pow(1.2, p.completed + segment)) * 2e6,
          tick: (p, a, s) => offset => (g.getSkillLevel('Magic') / 2 + g.getSkillLevel('Crafting'))
            * (1 + g.getLevelFromExp(s[a.loopStats[(p.completed + offset) % a.loopStats.length]]) / 100)
            * Math.sqrt(1 + p.total / 1000),
          effect: { segment: r => r.gold += 10 }
        }},

        // Dungeon-style loops
        'Small Dungeon': { affected: ['soul'], loop: {
          max: a => g.dungeons[a.dungeonNum].length,
          cost: (p, a) => segment => g.precision3(Math.pow(2, Math.floor((p.completed + segment) / a.segments + .0000001)) * 15000),
          tick: (p, a, s) => offset => {
            let floor = Math.floor(p.completed / a.segments + .0000001);

            if (!(floor in g.dungeons[a.dungeonNum])) return 0;

            return (g.getSkillLevel('Combat') + g.getSkillLevel('Magic'))
              * (1 + g.getLevelFromExp(s[a.loopStats[(p.completed + offset) % a.loopStats.length]]) / 100)
              * Math.sqrt(1 + g.dungeons[a.dungeonNum][floor].completed / 200);
          },
          effect: { loop: r => r.soul++ },
        }},
        'Large Dungeon': { affected: ['soul'], loop: {
          max: a => g.dungeons[a.dungeonNum].length,
          cost: (p, a) => segment => g.precision3(Math.pow(3, Math.floor((p.completed + segment) / a.segments + .0000001)) * 5e5),
          tick: (p, a, s, r) => offset => {
            let floor = Math.floor(p.completed / a.segments + .0000001);
            let selfCombat = g.getSkillLevel('Combat') * (1 + ((r.armor || 0) * g.getCraftGuildRank().bonus) / 5);
            let teamCombat = selfCombat + g.getSkillLevel('Combat') * (r.team || 0) / 2 * g.getAdvGuildRank().bonus;

            if (!(floor in g.dungeons[a.dungeonNum])) return 0;

            return (teamCombat + g.getSkillLevel('Magic'))
              * (1 + g.getLevelFromExp(s[a.loopStats[(p.completed + offset) % a.loopStats.length]]) / 100)
              * Math.sqrt(1 + g.dungeons[a.dungeonNum][floor].completed / 200);
          },
          effect: { loop: r => r.soul++ }
        }},
        'Tournament': { affected: ['gold'], loop: {
          max: () => 6,
          cost: (p) => segment => g.precision3(Math.pow(1.1, p.completed + segment)) * 5e6,
          tick: (p, a, s, r) => offset => {
            let selfCombat = g.getSkillLevel('Combat') * (1 + ((r.armor || 0) * g.getCraftGuildRank().bonus) / 5);
            return (g.getSkillLevel('Magic') + selfCombat)
              * (1 + g.getLevelFromExp(s[a.loopStats[(p.completed + offset) % a.loopStats.length]]) / 100)
              * Math.sqrt(1 + p.total / 1000);
          },
          effect: { segment: r => (r.tourney = (r.tourney || 0) + 1, r.gold += 40 + Math.floor(r.tourney / 3 + .00001) * 20) }
        }},
      };

      /**
       * Prediction collection
       * @member {Object.<string, Prediction>}
       */
      this.predictions = {};

      // Create predictions
      for (const name in predictions) {
        this.predictions[name] = new Koviko.Prediction(name, predictions[name]);
      }
    }

    /**
     * Update the action list view.
     * @param {Array.<IdleLoops~ListedAction>} actions Actions in the action list
     * @param {HTMLElement} [container] Parent element of the action list
     * @param {boolean} [isDebug] Whether to log useful debug information
     * @memberof Koviko.Predictor
     */
    update(actions, container, isDebug) {
      /**
       * Organize accumulated resources, accumulated stats, and accumulated progress into a single object
       * @var {Predictor~State}
       */
      const state = {
        resources: { mana: 250 },
        stats: Koviko.globals.statList.reduce((stats, name) => (stats[name] = 0, stats), {}),
        progress: {}
      };

      /**
       * Total mana used for the action list
       * @var {number}
       */
      let total = 0;

      /**
       * All affected resources of the current action list
       * @var {Array.<string>}
       */
      const affected = Object.keys(actions.reduce((stats, x) => (x.name in this.predictions && this.predictions[x.name].affected || []).reduce((stats, name) => (stats[name] = true, stats), stats), {}));

      /**
       * Template function to create the display on a given action in the action list
       * @param {Predictor~Resources} resources Accumulated resources
       * @param {boolean} isValid Whether the amount of mana remaining is valid for this action
       */
      const template = (resources, isValid) => (isValid = 'koviko' + (isValid ? '' : ' invalid'), `<ul class="${isValid}">` + affected.map(name => `<li class=${name}>${resources[name]}</li>`).join('') + '</ul>');

      // Initialize all affected resources
      affected.forEach(x => state.resources[x] || (state.resources[x] = 0));

      // Initialize the display element for the total amount of mana used
      container && (this.totalDisplay.innerHTML = '');

      // Run through the action list and update the view for each action
      actions.forEach((listedAction, i) => {
        /** @var {Prediction} */
        let prediction = this.predictions[listedAction.name];

        if (prediction) {
          /**
           * Element for the action in the list
           * @var {HTMLElement}
           */
          let div = container ? container.children[i] : null;

          /** @var {boolean} */
          let isValid = true;

          /** @var {number} */
          let currentMana;

          // Make sure that the loop is properly represented in `state.progress`
          if (prediction.loop && !(prediction.name in state.progress)) {
            /** @var {Predictor~Progression} */
            state.progress[prediction.name] = {
              progress: 0,
              completed: 0,
              total: Koviko.globals.towns[prediction.action.townNum]['total' + prediction.action.varName],
            };
          }

          // Predict each loop in sequence
          for (let loop = 0; loop < listedAction.loops; loop++) {
            // Save the mana prior to the prediction
            currentMana = state.resources.mana;

            // Run the prediction
            this.predict(prediction, state);

            // Check if the amount of mana used was too much
            isValid = isValid && state.resources.mana >= 0;

            // Calculate the total amount of mana used in the prediction and add it to the total
            total += currentMana - state.resources.mana;

            // Run the effect, now that the mana checks are complete
            if (prediction.effect) {
              prediction.effect(state.resources);
            }
          }

          // Update the view
          div && (div.innerHTML += template(state.resources, isValid));
        }
      });

      // Update the display for the total amount of mana used by the action list
      container && (this.totalDisplay.innerHTML = total);

      // Log useful debugging data
      if (isDebug) {
        console.log({
          actions: actions,
          affected: affected,
          state: state,
          total: total
        });
      }
    }

    /**
     * Perform one tick of a prediction
     * @param {Prediction} prediction Prediction object
     * @param {Predictor~State} state State object
     * @return {boolean} Whether another tick can occur
     * @memberof Koviko.Predictor
     */
    tick(prediction, state) {
      // Apply the accumulated stat experience
      prediction.exp(prediction.action, state.stats);

      // Handle the loop if it exists
      if (prediction.loop) {
        /** @var {Predictor~Progression} */
        const progression = state.progress[prediction.name];

        /** @var {function} */
        const loopCost = prediction.loop.cost(progression, prediction.action);

        /** @var {function} */
        const tickProgress = prediction.loop.tick(progression, prediction.action, state.stats, state.resources);

        /** @var {number} */
        const totalSegments = prediction.action.segments;

        /** @var {number} */
        const maxSegments = prediction.loop.max ? prediction.loop.max(prediction.action) * totalSegments : Infinity;

        /**
         * Current segment within the loop
         * @var {number}
         */
        let segment = 0;

        /**
         * Progress through the current loop
         * @var {number}
         */
        let progress = progression.progress;

        // Calculate the progress and current segment before the tick
        for (; progress >= loopCost(segment); progress -= loopCost(segment++));

        /**
         * Progress of the tick
         * @var {number}
         */
        let additionalProgress = tickProgress(segment) * (prediction.action.manaCost() / prediction.ticks());

        // Accumulate the progress from the tick
        progress += additionalProgress;
        progression.progress += additionalProgress;

        // Calculate the progress and current segment after the tick
        for (; progress >= loopCost(segment) && segment < maxSegments; progress -= loopCost(segment++)) {
          // Handle the completion of a loop
          if (segment >= totalSegments - 1) {
            progression.progress = 0;
            progression.completed += totalSegments;
            progression.total++;
            segment -= totalSegments;

            // Apply the effect from the completion of a loop
            if (prediction.loop.effect.loop) {
              prediction.loop.effect.loop(state.resources);
            }
          }

          // Apply the effect from the completion of a segment
          if (prediction.loop.effect.segment) {
            prediction.loop.effect.segment(state.resources);
          }
        }

        return additionalProgress && segment < maxSegments;
      }

      return true;
    }

    /**
     * Perform all ticks of a prediction
     * @param {Prediction} prediction Prediction object
     * @param {Predictor~state} state State object
     * @memberof Koviko.Predictor
     */
    predict(prediction, state) {
      // Update the amount of ticks necessary to complete the action, but only once at the start of the action
      prediction.updateTicks(prediction.action, state.stats);

      // Perform all ticks in succession
      for (let ticks = 0; ticks < prediction.ticks(); ticks++) {
        state.resources.mana--;
        if (!this.tick(prediction, state)) break;
      }
    }
  }
}

// Run the code!
const runIdleLoopsPredictor = () => {
  for (let varName in Koviko.globals) {
    try {
      Koviko.globals[varName] = eval(varName);
    } catch (e) {
      console.log(`Unable to retrieve global '${varName}'.`);
      return;
    }
  }

  window.Koviko = new Koviko.Predictor(Koviko.globals.view, Koviko.globals.actions, Koviko.globals.nextActionsDiv);
};

window.addEventListener('load', runIdleLoopsPredictor);
if (document.readyState == 'complete') runIdleLoopsPredictor();
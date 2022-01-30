'use strict';

const NodeBotvacRobot = require('node-botvac/lib/robot');

class BotvacRobot {

  robot
  log;
  constructor(device) {
    this.robot = new NodeBotvacRobot(device.getName(), device.data.id, device.store.secret, null);
    this.log = device.log;
  }

  /**
   * Get current state.
   */
  async getState() {
    const self = this;
    self.log('getState function call');
    const statePromise = new Promise((resolve, reject) => {
      self.robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (!state) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${self.robot.name} didn't return states`);
        }
        resolve(state);
      });
    });

    return statePromise;
  }

  /**
   * Start the cleaning cycle.
   */
  async startCleaningCycle() {
    const self = this;
    self.log('startCleaning function call');
    const cleaningPromise = new Promise((resolve, reject) => {
      self.robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (!state || !state.availableCommands) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${self.robot.name} didn't return states`);
        }
        if (state.availableCommands.start) {
          self.robot.startCleaning(true, 2, true);
          self.log(`${self.robot.name} will start cleaning`);
          resolve(true);
        }
        if (state.availableCommands.resume) {
          self.robot.resumeCleaning();
          self.log(`${self.robot.name} will resume cleaning`);
          resolve(true);
        }
        // eslint-disable-next-line prefer-promise-reject-errors
        reject(`${self.robot.name} cannot start or resume`);
      });
    });

    return cleaningPromise;
  }

  /**
   * Start the cleaning cycle.
   */
  async startSpotCleaningCycle() {
    const self = this;
    self.log('startCleaning function call');
    const cleaningPromise = new Promise((resolve, reject) => {
      self.robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (!state || !state.availableCommands) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${self.robot.name} didn't return states`);
        }
        if (state.availableCommands.start) {
          // TODO: Replace with proper states
          // TODO make modes user configurable
          self.robot.startSpotCleaning(true, 100, 100, 1, 2);
          self.log(`${self.robot.name} will start spot cleaning`);
          resolve(true);
        }
        if (state.availableCommands.resume) {
          self.robot.resumeCleaning();
          self.log(`${self.robot.name} will resume cleaning`);
          resolve(true);
        }
        // eslint-disable-next-line prefer-promise-reject-errors
        reject(`${self.robot.name} cannot start or resume`);
      });
    });

    return cleaningPromise;
  }

  /**
   * Stop (pause) the cleaning cycle
   */
  async stopCleaningCycle() {
    const self = this;
    const stopCleaningPromise = new Promise((resolve, reject) => {
      // Cleaning must be paused, not stopped, if we want to be able to resume or send to dock
      self.robot.pauseCleaning((error, result) => {
        if (error) {
          self.log(`${self.robot.name} could not pause`);
          reject(error);
        }
        self.log(`${self.robot.name} was paused`);
        resolve(true);
      });
    });

    return stopCleaningPromise;
  }

  /**
   * Stop (pause) the cleaning cycle and send BotVac to dock.
   */
  async stopAndDock() {
    const self = this;

    // We might need to stop current cleaning cycle before docking
    try {
      await this.stopCleaningCycle();
    } catch (error) {
      // Do nothing on error.
      // This likely means the robot was already paused/stopped and we can try to dock it
    }

    const stopAndDockPromise = new Promise((resolve, reject) => {
      try {
        // It can take significant time from BotVac Pause until it can be sent to dock.
        // Resolving this with recursive loop for now that will give it ~30 seconds to resolve
        (async function loop(parentScope) {
          const iMax = 30;
          for (let i = 0; i < iMax; i++) {
            await parentScope.dockBotvac()
              .then(success => {
                i = iMax;
                resolve(success);
              }, fail => {
                parentScope.log(`Dock attempt ${i} failed: ${fail}`);
              });
          }
          parentScope.log(`Could not dock after ${iMax} tries`);
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`Could not dock after ${iMax} tries`);
        }(self));
      } catch (error) {
        reject(error);
      }
    });

    return stopAndDockPromise;
  }

  /**
   * Send BotVac to dock.
   */
  async dockBotvac() {
    const self = this;
    const dockPromise = new Promise((resolve, reject) => {
      self.robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (state && state.availableCommands) {
          self.log(state.availableCommands);
        }
        if (state && state.availableCommands && state.availableCommands.goToBase) {
          self.robot.sendToBase();
          self.log(`${self.robot.name} will return to base`);
          resolve(true);
        } else {
          self.log(`${self.robot.name} cannot return to base`);
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${self.robot.name} cannot return to base`);
        }
      });
    });
    return dockPromise;
  }

}

module.exports = BotvacRobot;

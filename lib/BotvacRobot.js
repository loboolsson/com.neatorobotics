'use strict';

const nodeBotvacRobot = require('node-botvac/lib/robot')

class BotvacRobot {

  robot
  log;
  constructor(device) {
    this.robot = new nodeBotvacRobot(device.getName(), device.data.id, device.store.secret, null);
    this.log = device.log;
  }

  /**
   * Get current state.
   */
   async getState() {
    const self = this;
    const robot = self.robot;
    self.log('getState function call');
    const statePromise = new Promise((resolve, reject) => {
      robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (!state) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${robot.name} didn't return states`);
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
    const robot = self.robot;
    self.log('startCleaning function call');
    const cleaningPromise = new Promise((resolve, reject) => {
      robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (!state || !state.availableCommands) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${robot.name} didn't return states`);
        }
        if (state.availableCommands.start) {
          robot.startCleaning(true, 2, true);
          self.log(`${robot.name} will start cleaning`);
          resolve(true);
        }
        if (state.availableCommands.resume) {
          robot.resumeCleaning();
          self.log(`${robot.name} will resume cleaning`);
          resolve(true);
        }
        // eslint-disable-next-line prefer-promise-reject-errors
        reject(`${robot.name} cannot start or resume`);
      });
    });

    return cleaningPromise;
  }

  /**
   * Start the cleaning cycle.
   */
   async startSpotCleaningCycle() {
    const self = this;
    const robot = self.robot;
    self.log('startCleaning function call');
    const cleaningPromise = new Promise((resolve, reject) => {
      robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (!state || !state.availableCommands) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${robot.name} didn't return states`);
        }
        if (state.availableCommands.start) {
          //TODO: Replace with proper states
          //TODO make modes user configurable
          robot.startSpotCleaning(true, 100, 100, 1, 2)
          self.log(`${robot.name} will start spot cleaning`);
          resolve(true);
        }
        if (state.availableCommands.resume) {
          robot.resumeCleaning();
          self.log(`${robot.name} will resume cleaning`);
          resolve(true);
        }
        // eslint-disable-next-line prefer-promise-reject-errors
        reject(`${robot.name} cannot start or resume`);
      });
    });

    return cleaningPromise;
  }

  /**
   * Stop (pause) the cleaning cycle
   */
  async stopCleaningCycle() {
    const self = this;
    const robot = self.robot;
    const stopCleaningPromise = new Promise((resolve, reject) => {
      // Cleaning must be paused, not stopped, if we want to be able to resume or send to dock
      robot.pauseCleaning((error, result) => {
        if (error) {
          self.log(`${robot.name} could not pause`);
          reject(error);
        }
        self.log(`${robot.name} was paused`);
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
    const robot = self.robot;
    const stopAndDockPromise = new Promise((resolve, reject) => {
      try {
        //TODO: we should only pause if the robot is active somehow

        await this.stopCleaningCycle();
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
  
      } catch(error) {
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
    const robot = self.robot;
    const dockPromise = new Promise((resolve, reject) => {
      robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (state && state.availableCommands) {
          self.log(state.availableCommands);
        }
        if (state && state.availableCommands && state.availableCommands.goToBase) {
          robot.sendToBase();
          self.log(`${robot.name} will return to base`);
          resolve(true);
        } else {
          self.log(`${robot.name} cannot return to base`);
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${robot.name} cannot return to base`);
        }
      });
    });
    return dockPromise;
  }

}

module.exports = BotvacRobot;
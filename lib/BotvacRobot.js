'use strict';

const NodeBotvacRobot = require('node-botvac/lib/robot');
// Request response codes as defined by Neato
// https://developers.neatorobotics.com/api/robot-remote-protocol/request-response-formats
const states = {
  IDLE: 1,
  BUSY: 2,
  PAUSED: 3,
  ERROR: 4,
};
const actions = {
  HOUSE_CLEANING: 1,
  SPOT_CLEANING: 2,
  MANUAL_CLEANING: 3,
  DOCKING: 4,
  USER_MENU_ACTIVE: 5,
  SUSPENDED_CLEANING: 6,
  UPDATING: 7,
  COPYING_LOGS: 8,
  RECOVERING_LOCATION: 9,
  IEC_TEST: 10,
  MAP_EXPLORATION: 11,
  CREATE_MAP: 12,
  GET_MAP_IDS: 13,
  UPLOAD_MAPS: 14,
  SUSPENDED_EXPLORATION: 15,
};

const navigationMode = {
  NORMAL: 1,
  EXTRA_CARE: 2,
};

const noGoLines = {
  ENABLE: true,
  DISABLE: false,
};

const ecoMode = {
  ENABLE: true,
  DISABLE: false,
};

const stateTTL = 3000;

class BotvacRobot {

  robot;
  log;
  settings;
  latestState = {};
  stateRefresh = 0;

  constructor(device) {
    this.robot = new NodeBotvacRobot(device.getName(), device.data.id, device.store.secret, null);
    this.log = device.log;
  }

  /**
   * Return true if robot is running "normal" cleaning
   * NOTE: Cleaning hasn't started untill "availableCommands" lists start as false
   */
  async isCleaning() {
    const state = await this.getState();

    return state.state === states.BUSY
      && state.action !== actions.SPOT_CLEANING
      && !state.availableCommands.start;
  }

  /**
   * Return true if robot is running spot cleaning
   * NOTE: Cleaning hasn't started untill "availableCommands" lists start as false
   */
  async isSpotCleaning() {
    const state = await this.getState();

    return state.state === states.BUSY
      && state.action === actions.SPOT_CLEANING
      && !state.availableCommands.start;
  }

  /**
   * Return true if robot is docked AND not charging
   */
  async isDocked() {
    const state = await this.getState();

    return state.details.isDocked && !state.details.isCharging;
  }

  /**
   * Return true if robot is charging
   */
  async isCharging() {
    const state = await this.getState();

    return state.details.isCharging;
  }

  /**
   * Return the error message if robot has some kind of error
   */
  async getError() {
    const state = await this.getState();
    if (!state.error) {
      return null;
    }

    // Some old models return a none-fatal error,
    // so we must check the result before assuming it is a true error
    if (state.result && state.result.toLowerCase() === 'ok') {
      return null;
    }

    return state.error;
  }

  /**
   * Return the charge state of the robot
   */
  async getBatteryCharge() {
    const state = await this.getState();

    return state.details.charge;
  }

  /**
   * Inject settings from the device
   */
  setSettings(settings) {
    this.settings = settings;
  }

  /**
   * Get navigation mode. Default is Extra Care
   */
  getNavigationMode() {
    if (parseInt(this.settings.navigationMode, 10) === navigationMode.NORMAL) {
      return navigationMode.NORMAL;
    }

    return navigationMode.EXTRA_CARE;
  }

  /**
   * Get eco mode. Default is enabled
   */
  getEcoMode() {
    if (!this.settings.ecoMode) {
      return ecoMode.DISABLE;
    }

    return ecoMode.ENABLE;
  }

  /**
   * Get noGoLines settings. Default is enabled
   */
  getNoGoLines() {
    if (!this.settings.noGoLines) {
      return noGoLines.DISABLE;
    }

    return noGoLines.ENABLE;
  }

  /**
   * Get current state.
   */
  async getState() {
    const self = this;
    const statePromise = new Promise((resolve, reject) => {
      if (self.stateRefresh > Date.now()) {
        resolve(self.latestState);
      } else {
        self.robot.getState((error, state) => {
          if (error) {
            self.log(`Lib error: ${self.robot.name} - Error when getting state`);
            reject(error);
          }
          if (!state) {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(`Lib error: ${self.robot.name} didn't return states`);
          }
          // To not flood the server with reqests we store the state for stateTTL milliseconds
          self.stateRefresh = Date.now() + stateTTL;
          self.latestState = state;
          resolve(state);
        });
      }
    });

    return statePromise;
  }

  /**
   * Start the cleaning cycle.
   */
  async startCleaningCycle() {
    const self = this;
    const cleaningPromise = new Promise((resolve, reject) => {
      (async (parentScope) => {
        try {
          const state = await parentScope.getState();
          if (!state || !state.availableCommands) {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(`${parentScope.robot.name} didn't return states`);
          } else if (state.availableCommands.start) {
            parentScope.robot.startCleaning(self.getEcoMode(), self.getNavigationMode(), self.getNoGoLines());
            parentScope.log(`${parentScope.robot.name} will start cleaning`);
            // Resetting state cache so Homey gets the new status
            // TODO: Create a better state handling/caching mechanism
            parentScope.stateRefresh = 0;
            resolve(true);
          } else if (state.availableCommands.resume) {
            parentScope.robot.resumeCleaning();
            parentScope.log(`${parentScope.robot.name} will resume cleaning`);
            // Resetting state cache so Homey gets the new status
            // TODO: Create a better state handling/caching mechanism
            parentScope.stateRefresh = 0;
            resolve(true);
          } else {
          // eslint-disable-next-line prefer-promise-reject-errors
            reject(`${parentScope.robot.name} cannot start or resume`);
          }
        } catch (error) {
          reject(error);
        }
      })(self);
    });

    return cleaningPromise;
  }

  /**
   * Start the spot cleaning cycle.
   */
  async startSpotCleaningCycle() {
    const self = this;
    const cleaningPromise = new Promise((resolve, reject) => {
      (async (parentScope) => {
        try {
          const state = await parentScope.getState();
          if (!state || !state.availableCommands) {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(`${parentScope.robot.name} didn't return states`);
          } else if (state.availableCommands.start) {
            parentScope.robot.startSpotCleaning(self.getEcoMode(), 100, 100, 1, self.getNavigationMode());
            parentScope.log(`${parentScope.robot.name} will start cleaning`);
            // Resetting state cache so Homey gets the new status
            // TODO: Create a better state handling/caching mechanism
            parentScope.stateRefresh = 0;
            resolve(true);
          } else if (state.availableCommands.resume) {
            parentScope.robot.resumeCleaning();
            parentScope.log(`${parentScope.robot.name} will resume cleaning`);
            // Resetting state cache so Homey gets the new status
            // TODO: Create a better state handling/caching mechanism
            parentScope.stateRefresh = 0;
            resolve(true);
          } else {
          // eslint-disable-next-line prefer-promise-reject-errors
            reject(`${parentScope.robot.name} cannot start or resume`);
          }
        } catch (error) {
          reject(error);
        }
      })(self);
    });

    return cleaningPromise;
  }

  /**
   * Stop (pause) the cleaning cycle
   */
  async stopCleaningCycle() {
    const self = this;
    const stopCleaningPromise = new Promise((resolve, reject) => {
      (async (parentScope) => {
        try {
          const state = await parentScope.getState();
          if (!state || !state.availableCommands) {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(`${parentScope.robot.name} didn't return states`);
          } else if (state.availableCommands.pause) {
          // Cleaning must be paused, not stopped, if we want to be able to resume or send to dock
            parentScope.robot.pauseCleaning();
            // Resetting state cache so Homey gets the new status
            // TODO: Create a better state handling/caching mechanism
            parentScope.stateRefresh = 0;
            resolve(true);
          } else if (state.availableCommands.stop) {
            // If we cannot pause try to stop instead
            parentScope.robot.stopCleaning();
            // Resetting state cache so Homey gets the new status
            // TODO: Create a better state handling/caching mechanism
            parentScope.stateRefresh = 0;
            resolve(true);
          } else {
          // eslint-disable-next-line prefer-promise-reject-errors
            reject(`${parentScope.robot.name} cannot pause or stop`);
          }
        } catch (error) {
          reject(error);
        }
      })(self);
    });

    return stopCleaningPromise;
  }

  /**
   * Send BotVac to dock.
   */
  async dockBotvac() {
    const self = this;
    const dockPromise = new Promise((resolve, reject) => {
      (async (parentScope) => {
        try {
          const state = await parentScope.getState();
          if (!state || !state.availableCommands) {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(`${parentScope.robot.name} didn't return states`);
            parentScope.log('error in states');
          } else if (state.availableCommands && state.availableCommands.goToBase) {
            parentScope.log('send to base');
            parentScope.robot.sendToBase();
            // Resetting state cache so Homey gets the new status
            // TODO: Create a better state handling/caching mechanism
            parentScope.stateRefresh = 0;
            resolve(true);
          } else {
            parentScope.log('cannot return to base');
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(`${parentScope.robot.name} cannot return to base`);
          }
        } catch (error) {
          reject(error);
        }
      })(self);
    });

    return dockPromise;
  }

}

module.exports = BotvacRobot;

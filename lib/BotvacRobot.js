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
  error;
  debug;
  settings;
  latestState = {};
  stateRefresh = 0;

  constructor(device) {
    this.robot = new NodeBotvacRobot(device.getName(), device.data.id, device.store.secret, null);
    this.log = device.log;
    this.error = device.error;
    this.debug = device.homey.settings.get('debug');
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
    const statePromise = new Promise((resolve, reject) => {
      if (this.stateRefresh > Date.now()) {
        resolve(this.latestState);
      } else {
        this.robot.getState((error, state) => {
          if (error) {
            this.log(`${this.robot.name} - Error when getting state`);
            reject(error);
          }
          if (!state) {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(`${this.robot.name} didn't return states`);
          }
          // To not flood the server with reqests we store the state for stateTTL milliseconds
          this.stateRefresh = Date.now() + stateTTL;
          this.latestState = state;
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
    try {
      const state = await this.getState();
      if (state.availableCommands.start) {
        this.robot.startCleaning(this.getEcoMode(), this.getNavigationMode(), this.getNoGoLines());
        this.log(`${this.robot.name} will start cleaning`);
        // Resetting state cache so Homey gets the new status
        // TODO: Create a better state handling/caching mechanism
        this.stateRefresh = 0;
        return true;
      } if (state.availableCommands.resume) {
        this.robot.resumeCleaning();
        this.log(`${this.robot.name} will resume cleaning`);
        // Resetting state cache so Homey gets the new status
        // TODO: Create a better state handling/caching mechanism
        this.stateRefresh = 0;
        return true;
      }
      this.log(`${this.robot.name} cannot start or resume`);
      throw new Error(`${this.robot.name} cannot start or resume`);
    } catch (error) {
      this.error(error);
      if (this.debug) {
        this.error(this.latestState);
      }
      throw new Error(error);
    }
  }

  /**
   * Start the spot cleaning cycle.
   */
  async startSpotCleaningCycle() {
    try {
      const state = await this.getState();
      if (state.availableCommands.start) {
        this.robot.startSpotCleaning(this.getEcoMode(), 100, 100, 1, this.getNavigationMode());
        this.log(`${this.robot.name} will start spot cleaning`);
        // Resetting state cache so Homey gets the new status
        // TODO: Create a better state handling/caching mechanism
        this.stateRefresh = 0;
        return true;
      } if (state.availableCommands.resume) {
        this.robot.resumeCleaning();
        this.log(`${this.robot.name} will resume spot cleaning`);
        // Resetting state cache so Homey gets the new status
        // TODO: Create a better state handling/caching mechanism
        this.stateRefresh = 0;
        return true;
      }
      throw new Error(`${this.robot.name} cannot start or resume`);
    } catch (error) {
      this.error(error);
      if (this.debug) {
        this.error(this.latestState);
      }
      throw new Error(error);
    }
  }

  /**
   * Stop (pause) the cleaning cycle
   */
  async stopCleaningCycle() {
    try {
      const state = await this.getState();
      if (state.availableCommands.pause) {
      // Cleaning must be paused, not stopped, if we want to be able to resume or send to dock
        this.robot.pauseCleaning();
        // Resetting state cache so Homey gets the new status
        // TODO: Create a better state handling/caching mechanism
        this.stateRefresh = 0;
        return true;
      } if (state.availableCommands.stop) {
        // If we cannot pause try to stop instead
        this.robot.stopCleaning();
        // Resetting state cache so Homey gets the new status
        // TODO: Create a better state handling/caching mechanism
        this.stateRefresh = 0;
        return true;
      }
      throw new Error(`${this.robot.name} cannot pause or stop`);
    } catch (error) {
      this.error(error);
      if (this.debug) {
        this.error(this.latestState);
      }
      throw new Error(error);
    }
  }

  /**
   * Send BotVac to dock.
   */
  async dockBotvac() {
    try {
      const state = await this.getState();
      if (state.availableCommands.goToBase) {
        this.log('send to base');
        this.robot.sendToBase();
        // Resetting state cache so Homey gets the new status
        // TODO: Create a better state handling/caching mechanism
        this.stateRefresh = 0;
        return true;
      }
      this.log(`Command 'goToBase' is not avaliable for ${this.robot.name}`);
      throw new Error(`Command 'goToBase' is not avaliable for ${this.robot.name}`);
    } catch (error) {
      this.error(error);
      if (this.debug) {
        this.error(this.latestState);
      }
      throw new Error(error);
    }
  }

}

module.exports = BotvacRobot;

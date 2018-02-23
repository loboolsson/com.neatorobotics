'use strict';

const Homey = require('homey');
const crypto = require('crypto');
const fetch = require('node-fetch');
const FormData = require('form-data');

const states = {
  IDLE: 1,
  BUSY: 2,
  PAUSED: 3,
  ERROR: 4,
}
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
}
const cleaningCategories = {
  MANUAL: 1,
  HOUSE: 2,
  SPOT: 3,
}
const cleaningModes = {
  ECO: 1,
  TURBO: 2,
}
const cleaningModifier = {
  ONCE: 1,
  TWICE: 2
}
const navigationModes = {
  NORMAL: 1,
  EXTRA_CARE: 2
}

class NeatoRobot {

  constructor(robot) {
    // Initialize robot properties
    this.name = robot.name;
    this.model = robot.model;
    this._serial = robot.serial;
    this._secret = robot.secret_key;

    // Initialize robot API properties
    this._baseUrl = 'https://nucleo.neatocloud.com';
    this._portNumber = 4443;
    this._baseApiUrl = `${this._baseUrl}:${this._portNumber}/vendors/neato/robots/${this._serial}/messages`;

    // General info
    this.charge = null;

    // Handy booleans
    this.isCleaning = null;
    this.isSpotCleaning = null;
    this.isCharging = null;
    this.isDocked = null;
    this.canGoToBase = null;
    this.hasError = null;

    // Error message if any
    this.error = null;
  }

  async _doRequest(requestSpec) {
    // Current time for request
    let time = new Date().toUTCString();
    let requestData = JSON.stringify(requestSpec);
    // Key for authentication
    let key = this._serial.toLowerCase() + '\n' + time + '\n' + requestData;
    // Digested key for authentication
    let hmac = crypto.createHmac('sha256', this._secret);
    hmac.update(key);

    let requestHeaders = {
      Accept: 'application/vnd.neato.nucleo.v1',
      Authorization: `NEATOAPP ${hmac.digest('hex')}`,
      'X-Date': time,
    };

    let response = await fetch(this._baseApiUrl, {method: 'POST', headers: requestHeaders, body: requestData});
    if (!response.ok) {
      console.log('Robot response status:', response.status);
      console.log('Robot response text:', response.statusText);
      throw new Error(Homey.__('Error in robot request'));
    }
    return await response.json();
  }

  /*
  ========================================================================================
  State code
  ========================================================================================
  */

  async getState() {
    let response = await this._doRequest({
      reqId: '1',
      cmd: 'getRobotState'
    });

    // Clear error state
    if (response.state !== states.ERROR) {
      this.hasError = false;
      this.error = null;
    }

    if (response.state === states.BUSY && response.action === (actions.HOUSE_CLEANING || actions.MANUAL_CLEANING || actions.SUSPENDED_CLEANING)) {
      this.isSpotCleaning = false
      this.isCleaning = true;
    } else if (response.state === states.BUSY && response.action === actions.SPOT_CLEANING){
      this.isCleaning = false;
      this.isSpotCleaning = true;
    } else if (response.state === states.ERROR) {
      this.isCleaning = false;
      this.isSpotCleaning = false;
      this.hasError = true;
      this.error = response.error;
    } else if (response.state === (states.IDLE || states.PAUSED)){
      this.isCleaning = false;
      this.isSpotCleaning = false;
    }

    if (response.details.isDocked) {
      this.isCleaning = false;
      this.isSpotCleaning = false;
      this.isDocked = true;
    } else if (!response.details.isDocked) {
      this.isDocked = false;
    }

    if (response.details.isCharging) {
      this.isCleaning = false;
      this.isSpotCleaning = false;
      this.isCharging = true;
    } else if (!response.details.isCharging) {
      this.isCharging = false;
    }

    response.availableCommands.goToBase ? this.canGoToBase = true : this.canGoToBase = false;

    this.charge = response.details.charge;

    return response;
  }

  /*
  ========================================================================================
  Cleaning code
  ========================================================================================
  */

  async startCleaning() {
    return await this._doRequest({
      reqId: '1',
      cmd: 'startCleaning',
      params: {
        category: cleaningCategories.HOUSE,
        mode: cleaningModes.TURBO,
        modifier: cleaningModifier.ONCE,
        navigationMode: navigationModes.NORMAL
      }
    });
  }

  async resumeCleaning() {
    return await this._doRequest({
      reqId: '1',
      cmd: 'resumeCleaning'
    });
  }

  async pauseCleaning() {
    return await this._doRequest({
      reqId: '1',
      cmd: 'pauseCleaning'
    });
  }

  async stopCleaning() {
    return await this._doRequest({
      reqId: '1',
      cmd: 'stopCleaning'
    });
  }

  /*
  ========================================================================================
  SpotCleaning code
  ========================================================================================
  */

  async startSpotCleaning() {
    return await this._doRequest({
      reqId: '1',
      cmd: 'startCleaning',
      params: {
        category: cleaningCategories.HOUSE,
        mode: cleaningModes.TURBO,
        modifier: cleaningModifier.ONCE,
        spotWidth: 100,
        spotHeigth: 100,
        navigationMode: navigationModes.NORMAL
      }
    });
  }

  /*
  ========================================================================================
  Base code
  ========================================================================================
  */

  async sendToBase() {
    return await this._doRequest({
      reqId: '1',
      cmd: 'sendToBase'
    });
  }
}

module.exports = NeatoRobot;

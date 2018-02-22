'use strict';

const Homey = require('homey');
// Overridden version of botvac client that's promisified, called Neato for ease of use
const Neato = require('../../lib/node-botvac-promisified');

const POLL_INTERVAL = 10000;
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
const navigationModes = {
  NORMAL: 1,
  EXTRA_CARE: 2,
}

class BotVacDevice extends Homey.Device {

  onInit() {
    this.driver = this.getDriver();
    this.data = this.getData();

    this.log('BotVac name:', this.getName());
    this.log('BotVac serial:', this.data.id);

    this.driver.once(`BotVac:${this.data.id}`, this._init.bind(this));
    this.registerCapabilityListener('vacuumcleaner_state', this._onCapabilityVaccumState.bind(this));
  }

  onDeleted() {
    this.log('BotVac removed');
    this.log('BotVac name:', this.getName());
    this.log('BotVac serial:', this.data.id);

    this.driver.removeRobot(this.data.id);
  }

  async _onPollState() {
    let state = await this.connection.getState();

    // If idle it's either charging or docked
    if (state.state === (states.IDLE || state.PAUSED)) {
      if (state.details.isCharging) this.setCapabilityValue('vacuumcleaner_state', 'charging');
      else if (state.details.isDocked) this.setCapabilityValue('vacuumcleaner_state', 'docked');
      else this.setCapabilityValue('vacuumcleaner_state', 'stopped');
    }
    // If busy it's cleaning or spot cleaning
    else if (state.state === states.BUSY) {
      // These cleaning modes go to normal cleaning
      if (state.action === (actions.HOUSE_CLEANING || actions.MANUAL_CLEANING || actions.SUSPENDED_CLEANING)) {
        this.setCapabilityValue('vacuumcleaner_state', 'cleaning');
      } else if (state.action === actions.SPOT_CLEANING) {
        this.setCapabilityValue('vacuumcleaner_state', 'spot_cleaning');
      }
    }
    // If there's an error put state to stopped and display the error
    else if (state.state === states.ERROR) {
      this.setCapabilityValue('vacuumcleaner_state', 'stopped');
      this.setUnavailable(Homey.__(state.error));
    }

    // Set battery charge
    this.setCapabilityValue('measure_battery', state.details.charge);

    // Log current status of bot
    this.log('Robot status updated:', this.connection);
  }

  async _onCapabilityVaccumState(value) {
    switch (value) {
      case 'cleaning':
        await this.connection.startCleaning(false, navigationModes.NORMAL);
        break;
      case 'spot_cleaning':
        await this.connection.startSpotCleaning(false, 100, 100, false, navigationModes.NORMAL);
        break;
      case 'docked':
      case 'charging':
        if (!this.connection.canGoToBase) {
          await this.connection.pauseCleaning();
          this.setCapabilityValue('vacuumcleaner_state', 'stopped');
          return Promise.reject(Homey.__('cannot_return'));
        }
        await this.connection.sendToBase();
        break;
      case 'stopped':
        await this.connection.pauseCleaning();
        break;
    }
  }

  async _init() {
    this.connection = this.driver.getRobot(this.data.id);
    this._onPollState();
    this._pollState = setInterval(this._onPollState.bind(this), POLL_INTERVAL);
    this.log('BotVac added');
  }
}

module.exports = BotVacDevice;

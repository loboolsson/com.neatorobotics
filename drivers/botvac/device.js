'use strict';

const Homey = require('homey');
const BotvacRobot = require('../../lib/BotvacRobot');

// Response codes as defined by Neato
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
};

class BotVacDevice extends Homey.Device {

  async onInit() {
    this.driver = this.getDriver();
    this.data = this.getData();
    this.store = this.getStore();

    // Get pollinterval or set it to the default of 10 if it doesn't exist
    this.pollInterval = (this.getSetting('poll_interval') || 10) * 1000;

    this._init();
  }

  onSettings(oldSettings, newSettings, changedKeys, callback) {
    if (changedKeys.includes('poll_interval')) {
      this.pollInterval = newSettings.poll_interval * 1000;
      clearInterval(this._pollStateInterval);

      this._pollStateInterval = setInterval(this._onPollState.bind(this), this.pollInterval);
    }

    callback(null, true);
  }

  onDeleted() {
    this.log(`BotVac removed: ${this.getName()} - ${this.data.id}`);
  }

  async _onPollState() {
    try {
      // Check robot's state
      const state = await this.robot.getState();
      // Default to available
      this.setAvailable();

      this.log(`state: ${JSON.stringify(state)}`);

      this.setCapabilityValue('measure_battery', state.details.charge);

      if (state.state === states.ERROR) {
        this.setCapabilityValue('vacuumcleaner_state', 'stopped');
        this.setUnavailable(Homey.__(state.error));
        this.log('state error');
      } else if (state.details.charging) {
        this.setCapabilityValue('vacuumcleaner_state', 'charging');
        this.log('state charge');
      } else if (state.details.isDocked) {
        this.setCapabilityValue('vacuumcleaner_state', 'docked');
        this.log('state docked');
      } else if (state.state === states.BUSY && state.action === actions.SPOT_CLEANING) {
        this.setCapabilityValue('vacuumcleaner_state', 'spot_cleaning');
        this.log('state spot cleaning');
      } else if (state.state === states.BUSY && state.action !== actions.SPOT_CLEANING) {
        this.setCapabilityValue('vacuumcleaner_state', 'cleaning');
        this.log('state normal cleaning');
      } else {
        this.setCapabilityValue('vacuumcleaner_state', 'stopped');
        this.log('state normal stop');
      }
    } catch (err) {
      this.error(err);
      this.setUnavailable('Neato API not reachable');
    }
  }

  // eslint-disable-next-line consistent-return
  async _onCapabilityVaccumState(value) {
    // eslint-disable-next-line default-case
    switch (value) {
      case 'cleaning':
        await this.robot.startCleaningCycle();
        break;
      case 'spot_cleaning':
        await this.robot.startSpotCleaningCycle();
        break;
      case 'docked':
      case 'charging':
        try {
          await this.robot.stopAndDock();
        } catch (error) {
          this.setCapabilityValue('vacuumcleaner_state', 'stopped');
          return Promise.reject(Homey.__('cannot_return'));
        }
        break;
      case 'stopped':
        await this.robot.stopCleaningCycle();
        break;
    }
  }

  async _init() {
    this.robot = new BotvacRobot(this);

    this.registerCapabilityListener('vacuumcleaner_state', this._onCapabilityVaccumState.bind(this));

    this._onPollState();
    this._pollStateInterval = setInterval(this._onPollState.bind(this), this.pollInterval);

    this.log(`BotVac added: ${this.getName()} - ${this.data.id}`);
  }

}

module.exports = BotVacDevice;

'use strict';

const Homey = require('homey');
// Overridden version of botvac client that's promisified, called Neato for ease of use
const Neato = require('../../lib/node-botvac-promisified');

const POLL_INTERVAL = 15000;
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

class BotVacDevice extends Homey.Device {

  onInit() {
    this.driver = this.getDriver();
    this.data = this.getData();

    this.log('BotVac name:', this.getName());
    this.log('BotVac serial:', this.data.id);

    this.driver.once(`BotVac:${this.data.id}`, this._init.bind(this));
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
    if (state.state === states.IDLE) {
      if (this.connection.isCharging) this.setCapabilityValue('vacuumcleaner_state', 'charging');
      else this.setCapabilityValue('vacuumcleaner_state', 'docked');
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
    // If paused or there's an error the state is stopped
    else if (state.state === (states.PAUSED || states.ERROR)) this.setCapabilityValue('vacuumcleaner_state', 'stopped');

    // Set battery charge
    this.setCapabilityValue('measure_battery', this.connection.charge);
  }

  async _init() {
    this.connection = this.driver.getRobot(this.data.id);
    this._onPollState();
    this._pollState = setInterval(this._onPollState.bind(this), POLL_INTERVAL);
    this.log('BotVac added');
  }
}

module.exports = BotVacDevice;

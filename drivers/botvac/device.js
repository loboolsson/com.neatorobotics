'use strict';

const Homey = require('homey');
// Overridden version of botvac client that's promisified, called Neato for ease of use
const Neato = require('../../lib/node-botvac-promisified');

const POLL_INTERVAL = 1000;

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

  _onPollState() {
    let state = await this.connection.getState();

    if (robot.isDocked) this.setCapabilityValue('vacuumcleaner_state', 'docked');
    if (robot.isCharging) this.setCapabilityValue('vacuumcleaner_state', 'charging');
    if (robot.canStop || robot.canPause) this.setCapabilityValue('vacuumcleaner_state', 'cleaning');
    if (robot.canResume) this.setCapabilityValue('vacuumcleaner_state', 'stopped');

    this.setCapabilityValue('measure_battery', robot.charge);

    this.log('BotVac added');
  }

  async _init() {
    this.connection = this.driver.getRobot(this.data.id);
    this._onPollState();
    this._pollState = setInterval(this._onPollState.bind(this), POLL_INTERVAL);
  }
}

module.exports = BotVacDevice;

'use strict';

const Homey = require('homey');
const BotvacRobot = require('../../lib/BotvacRobot');

class BotVacDevice extends Homey.Device {

  async onInit() {
    this.data = this.getData();
    this.store = this.getStore();

    // Get pollinterval or set it to the default of 10 seconds if it doesn't exist
    this.pollInterval = (this.getSetting('poll_interval') || 10) * 1000;

    this._init();
  }

  onSettings(oldSettings, newSettings, changedKeys, callback) {
    if (changedKeys.includes('poll_interval')) {
      this.pollInterval = newSettings.poll_interval * 1000;
      clearInterval(this._pollStateInterval);

      this._pollStateInterval = setInterval(this._onPollState.bind(this), this.pollInterval);
    }
    this.robot.setSettings(newSettings);

    callback(null, true);
  }

  onDeleted() {
    this.log(`BotVac removed: ${this.getName()} - ${this.data.id}`);
  }

  async _onPollState() {
    try {
      // Default to available
      this.setAvailable();

      this.setCapabilityValue('measure_battery', await this.robot.getBatteryCharge());

      if (await this.robot.getError()) {
        this.setCapabilityValue('vacuumcleaner_state', 'stopped');
        this.setUnavailable(Homey.__(await this.robot.getError()));
        this.log(`Device Driver error: ${this.getName()} - ${await this.robot.getState()}`);
      } else if (await this.robot.isCharging()) {
        this.setCapabilityValue('vacuumcleaner_state', 'charging');
      } else if (await this.robot.isDocked()) {
        this.setCapabilityValue('vacuumcleaner_state', 'docked');
      } else if (await this.robot.isSpotCleaning()) {
        this.setCapabilityValue('vacuumcleaner_state', 'spot_cleaning');
      } else if (await this.robot.isCleaning()) {
        this.setCapabilityValue('vacuumcleaner_state', 'cleaning');
      } else {
        this.setCapabilityValue('vacuumcleaner_state', 'stopped');
      }
    } catch (err) {
      this.error(err);
      this.setUnavailable('Neato API not reachable');
      this.log(`Device Driver error: ${this.getName()} - Neato API not reachable`);
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
          await this.robot.dockBotvac();
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
    this.robot.setSettings(this.getSettings());

    this.registerCapabilityListener('vacuumcleaner_state', this._onCapabilityVaccumState.bind(this));

    this._onPollState();
    this._pollStateInterval = setInterval(this._onPollState.bind(this), this.pollInterval);

    this.log(`BotVac added: ${this.getName()} - ${this.data.id}`);
  }

}

module.exports = BotVacDevice;

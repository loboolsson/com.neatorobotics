'use strict';

const Homey = require('homey');
const NeatoRobot = require('../../lib/NeatoRobot');

class BotVacDevice extends Homey.Device {

  async onInit() {
    this.driver = this.getDriver();
    this.data = this.getData();
    this.store = this.getStore();

    this.log('BotVac name:', this.getName());
    this.log('BotVac serial:', this.data.id);

    this.getSetting('poll_interval') ? this.pollInterval = this.getSetting('poll_interval') * 1000 : this.pollInterval = 10000;

    this._init();
  }

  onSettings(oldSettings, newSettings, changedKeys, callback) {
      if (changedKeys.contains('poll_interval')) {
        this.pollInterval = newSettings.poll_interval * 1000;
        clearInterval(this._pollStateInterval);

        this._pollStateInterval = setInterval(this._onPollState.bind(this), this.pollInterval);
      }

      callback(null, true);
  }

  onDeleted() {
    this.log('BotVac removed');
    this.log('BotVac name:', this.getName());
    this.log('BotVac serial:', this.data.id);
  }

  async _onPollState() {

    try {
      let state = await this.connection.getState();

      // Clear errors first
      if (!this.connection.hasError) {
        this.setAvailable();
      }

      // Check robot's state
      if (this.connection.isCleaning) {
        this.setCapabilityValue('vacuumcleaner_state', 'cleaning');
      } else if (this.connection.isSpotCleaning) {
        this.setCapabilityValue('vacuumcleaner_state', 'spot_cleaning');
      } else if (this.connection.isCharging) {
        this.setCapabilityValue('vacuumcleaner_state', 'charging');
      } else if (this.connection.isDocked) {
        this.setCapabilityValue('vacuumcleaner_state', 'docked');
      } else if (this.connection.hasError) {
        this.setCapabilityValue('vacuumcleaner_state', 'stopped');
        this.setUnavailable(Homey.__(state.error));
      } else {
        this.setCapabilityValue('vacuumcleaner_state', 'stopped');
      }

      // Set battery charge
      this.setCapabilityValue('measure_battery', this.connection.charge);
      this.setAvailable();
    } catch (err) {
      this.error(err);
      this.setUnavailable('Neato API not reachable');
    }
  }

  async _onCapabilityVaccumState(value) {
    switch (value) {
      case 'cleaning':
        await this.connection.startCleaning();
        break;
      case 'spot_cleaning':
        await this.connection.startSpotCleaning();
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
    this.connection = new NeatoRobot({
      name: this.getName(),
      serial: this.data.id,
      secret_key: this.store.secret
    });

    this.registerCapabilityListener('vacuumcleaner_state', this._onCapabilityVaccumState.bind(this));

    this._onPollState();
    this._pollStateInterval = setInterval(this._onPollState.bind(this), this.pollInterval);

    this.log('BotVac added');
  }
}

module.exports = BotVacDevice;

'use strict';

const Homey = require('homey');
// Overridden version of botvac client that's promisified, called Neato for ease of use
const Neato = require('../../lib/node-botvac-promisified');

const POLL_INTERVAL = 10000;

class BotVacDevice extends Homey.Device {

  async onInit() {
    this.driver = this.getDriver();
    this.data = this.getData();

    this.log('BotVac name:', this.getName());
    this.log('BotVac serial:', this.data.id);

    this._init();
  }

  onDeleted() {
    this.log('BotVac removed');
    this.log('BotVac name:', this.getName());
    this.log('BotVac serial:', this.data.id);
  }

  async _onPollState() {
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

    this.log('Robot updated:', this.connection);
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
    if (!this.driver.neatoApi.getToken() || !this.driver.neatoApi.getRefreshToken()) {
      this.driver.neatoApi.setToken(this.data.access_token);
      this.driver.neatoApi.setRefreshToken(this.data.refresh_token);
    }

    this.connection = await this.driver.neatoApi.getOneRobot(this.data.id);
    this.registerCapabilityListener('vacuumcleaner_state', this._onCapabilityVaccumState.bind(this));

    this._onPollState();
    this._pollStateInterval = setInterval(this._onPollState.bind(this), POLL_INTERVAL);

    this.log('BotVac added');
  }
}

module.exports = BotVacDevice;

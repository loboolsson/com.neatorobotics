'use strict';

const Homey = require('homey');
const BotvacRobot = require('../../lib/BotvacRobot');

class BotVacDevice extends Homey.Device {

  async onInit() {
    this.data = this.getData();
    this.store = this.getStore();

    // Get pollinterval or set it to the default of 10 seconds if it doesn't exist
    this.pollInterval = (this.getSetting('poll_interval') || 10) * 1000;

    this.robot = new BotvacRobot(this);

    this.robot.setSettings(this.getSettings());
    this.registerCapabilityListener('vacuumcleaner_state', this._onCapabilityVaccumState.bind(this));
    this._onPollState();
    this._pollStateInterval = setInterval(this._onPollState.bind(this), this.pollInterval);

    this.log(`BotVac added: ${this.getName()} - ${this.data.id}`);
  }

  onSettings(settingsEvent) {
    if (settingsEvent.changedKeys.includes('poll_interval')) {
      this.pollInterval = settingsEvent.newSettings.poll_interval * 1000;
      clearInterval(this._pollStateInterval);
      this._pollStateInterval = setInterval(this._onPollState.bind(this), this.pollInterval);
    }
    this.robot.setSettings(settingsEvent.newSettings);
  }

  onDeleted() {
    this.log(`BotVac removed: ${this.getName()} - ${this.data.id}`);
  }

  async _onPollState() {
    try {
      // If we get an error, set state as stopped, device as unavaliable and return early.
      const robotError = await this.robot.getError();
      if (robotError) {
        this.setCapabilityValue('vacuumcleaner_state', 'stopped');
        throw new Error(robotError);
      }

      // If no error, default to available and set relevant status(es)
      this.setAvailable();
      this.setCapabilityValue('measure_battery', await this.robot.getBatteryCharge());
      if (await this.robot.isCharging()) {
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
    } catch (error) {
      this.error('_onPollState');
      this.error(error);
      if (this.homey.app.debug) {
        this.error(await this.robot.getState());
      }
      this.setUnavailable(error);
      throw new Error(error);
    }
  }

  // eslint-disable-next-line consistent-return
  async _onCapabilityVaccumState(value) {
    // TODO
    // We need to handle allowed/disallowed state transitions
    // IE, we cannot force the bot to charge,
    // so if it is already docked it cannot be switched to the charged state,
    // and if it is charging in the doc we cannot have it be docked without charging
    // We also cannot switch from normal cleaning to spot-cleaning on the fly
    try {
      // eslint-disable-next-line default-case
      switch (value) {
        case 'cleaning':
          return this.robot.startCleaningCycle();
        case 'spot_cleaning':
          return this.robot.startSpotCleaningCycle();
        case 'docked':
        case 'charging':
          return this.robot.dockBotvac();
        case 'stopped':
          return this.robot.stopCleaningCycle();
      }
    } catch (error) {
      this.error('_onCapabilityVaccumState');
      this.error(error);
      if (this.homey.app.debug) {
        this.error(await this.robot.getState());
      }
      this._onPollState();
      throw new Error(error);
    }
  }

}

module.exports = BotVacDevice;

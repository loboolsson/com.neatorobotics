'use strict';

const Homey = require('homey');
const BotvacRobot = require('../../lib/BotvacRobot');

class BotVacDevice extends Homey.Device {

  pollStateBinding = null;
  currentPollingInterval = 0;
  pollingError = 0;

  async onInit() {
    this.data = this.getData();
    this.store = this.getStore();
    this.robot = new BotvacRobot(this);
    this.robot.setSettings(this.getSettings());
    this.registerCapabilityListener('vacuumcleaner_state', this._onCapabilityVaccumState.bind(this));
    this._onPollState();
    this.setPollStateInterval(this.getSetting('poll_interval'));
    this.log(`BotVac added: ${this.getName()} - ${this.data.id}`);
  }

  onSettings(settingsEvent) {
    if (settingsEvent.changedKeys.includes('poll_interval')) {
      this.setPollStateInterval(settingsEvent.newSettings.poll_interval);
    }
    this.robot.setSettings(settingsEvent.newSettings);
  }

  setPollStateInterval(interval) {
    if (!interval || interval < 10 || interval > 600) {
      interval = 10;
    }

    if (this.pollStateBinding) {
      clearInterval(this.pollStateBinding);
    }
    this.currentPollingInterval = interval;
    this.pollStateBinding = setInterval(this._onPollState.bind(this), (interval * 1000));
    this.log(`Poll setting changed: ${this.getName()} - ${interval}`);
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

      // If no error, reset error counter, default to available and set relevant status(es)
      if (this.pollingError) {
        this.pollingError = 0;
        this.setPollStateInterval(this.getSetting('poll_interval'));
      }

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
      // to prevent long running/cascading errors to bog up Homey or flood the Neato api,
      // we increase the interval for each successive error up to the maximum of 600 sec
      this.pollingError++;
      this.setPollStateInterval(this.currentPollingInterval * this.pollingError);
      this.error('_onPollState');
      this.error(error);
      this.setUnavailable(error);
      if (this.homey.app.debug) {
        this.error(await this.robot.getState());
        throw new Error(error);
      }
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

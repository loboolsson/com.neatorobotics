'use strict';

const Homey = require('homey');
const BotvacRobot = require('../../lib/BotvacRobot');

class BotVacDevice extends Homey.Device {

  pollStateBinding = null;
  pollingError = 0;
  pollingLock = false;

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

  /**
   * Handle setting changes and make sure we update the poll rate correctly
   */
  onSettings(settingsEvent) {
    if (settingsEvent.changedKeys.includes('poll_interval')) {
      this.setPollStateInterval(settingsEvent.newSettings.poll_interval);
    }
    this.robot.setSettings(settingsEvent.newSettings);
  }

  /**
   * Set the interval for polling Neato API
   * accepts seconds as integer, minimum 10s, maximum 600s. Defaults to 10
   */
  setPollStateInterval(interval) {
    if (!interval || !Number.isInteger(interval) || interval < 10) {
      interval = 10;
    }

    if (interval > 600) {
      interval = 600;
    }

    if (this.pollStateBinding) {
      clearInterval(this.pollStateBinding);
    }
    this.pollStateBinding = setInterval(this._onPollState.bind(this), (interval * 1000));
    this.log(`Poll interval changed: ${this.getName()} - ${interval}`);
  }

  onDeleted() {
    this.log(`BotVac removed: ${this.getName()} - ${this.data.id}`);
  }

  async _onPollState() {
    // To prevent a Poll starting before the previous finished we lock polling
    if (this.pollingLock) {
      this.log('Polling locked');
      return;
    }
    try {
      this.pollingLock = true;
      // If we get an error, set state as stopped, device as unavaliable and return early.
      const robotError = await this.robot.getError();
      if (robotError) {
        this.setCapabilityValue('vacuumcleaner_state', 'stopped');
        throw new Error(robotError);
      }

      // If we've had earlier errors, reset counter and poll interval
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
      this.pollingLock = false;
    } catch (error) {
      this.setUnavailable(error);

      // to prevent long running/cascading errors to bog up Homey or flood the Neato api,
      // we exponentially increase the interval for each successive error up to the maximum of 600 sec
      // Maximum would be hit within 8 failed calls
      this.pollingError++;
      this.setPollStateInterval(this.getSetting('poll_interval') * this.pollingError * this.pollingError);

      // Log error data
      let errorLog = '_onPollState \n';
      errorLog += `errorCount: ${this.pollingError} \n`;
      errorLog += `${error} \n`;

      // If we are in the debug state log additional state info
      if (this.homey.settings.get('debug')) {
        errorLog += `State: ${JSON.stringify(await this.robot.getState(), null, 2)} \n`;
      }
      this.error(errorLog);
      this.pollingLock = false;

      // If user is in debug mode and we have multiple repeat errors
      // throw the error instead of waiting for a user report.
      // We only throw the error once when the user reaches 10 consequtive failures
      if (this.homey.settings.get('debug') && this.pollingError === 10) {
        throw new Error(errorLog);
      }
    }
  }

  // eslint-disable-next-line consistent-return
  async _onCapabilityVaccumState(newState) {
    try {
      // eslint-disable-next-line default-case
      switch (newState) {
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
      // Log error data
      let errorLog = '_onCapabilityVaccumState \n';
      errorLog += `${error} \n`;
      // If we are in the debug state log additional state info
      if (this.homey.settings.get('debug')) {
        errorLog += `State: ${JSON.stringify(await this.robot.getState(), null, 2)} \n`;
      }
      this.error(errorLog);
    }
  }

}

module.exports = BotVacDevice;

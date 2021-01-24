'use strict';

const Homey = require('homey');
const BotvacLibrary = require('./lib/Botvac');

class BotVacCommunity extends Homey.App {

  botvacLibrary={};

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    // Init BotvacLibrary
    try {
      this.botvacLibrary = new BotvacLibrary(
        this.homey.settings.get('username'),
        this.homey.settings.get('password'),
        this.log,
      );
    } catch (error) {
      this.log('Botvac initiated with error', error);
    }

    // Register Actions
    const startCleaningAction = this.homey.flow.getActionCard('start_cleaning');
    startCleaningAction
      .registerRunListener(async (args, state) => {
        this.log('Register start cleaning');
        return this.botvacLibrary.startCleaningCycle();
      });

    const stopCleaningAction = this.homey.flow.getActionCard('stop_cleaning');
    stopCleaningAction
      .registerRunListener(async (args, state) => {
        this.log('Register stop cleaning');
        return this.botvacLibrary.stopCleaningCycle();
      });

    this.log('BotVacCommunity has been initialized');
  }

}

module.exports = BotVacCommunity;

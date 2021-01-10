'use strict';

const Homey = require('homey');
const Botvac = require('node-botvac');

class BotVacCommunity extends Homey.App {
  credentials={};

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {

    //Register Actions
    let startCleaningAction = this.homey.flow.getActionCard('start_cleaning');
    startCleaningAction
        .registerRunListener(async (args, state) => {
          this.log("Has started");
          let startCleaning = this.startCleaning(this.log);
          return startCleaning;
        });

    let stopCleaningAction = this.homey.flow.getActionCard('stop_cleaning');
    stopCleaningAction.registerRunListener(async (args, state) => {
      // this.homey.speak("Stop Cleaning");
      this.log("Has stopped");
      let StopCleaning = this.stopCleaning(this.log);
      return StopCleaning;
    });

    //get user credentials
    this.credentials.user = this.homey.settings.get('username');
    this.credentials.pass = this.homey.settings.get('password');

    this.log('BotVacCommunity has been initialized');
  }

  startCleaning (log) {
    var client = new Botvac.Client();
    //authorize
    client.authorize(this.credentials.user, this.credentials.pass, true, function (error) {
      if (error) {
        log(error);
        return Promise.resolve(false);
      }
      //get your robots
      client.getRobots(function (error, robots) {
        if (error) {
          log(error);
          return Promise.resolve(false);
        }
        if (robots.length) {
          //Start cleaning with the First Robot

          log(robots[0]);
          log(robots[0].name + " will start cleaning");
          robots[0].startCleaning(true, 2, true);
          return Promise.resolve(true);
        }
      });
    });
  }

  stopCleaning (log) {
    var client = new Botvac.Client();
    //authorize
    client.authorize(this.credentials.user, this.credentials.pass, true, function (error) {
      if (error) {
        log(error);
        return Promise.resolve(false);
      }
      //get your robots
      client.getRobots(function (error, robots) {
        if (error) {
          log(error);
          return Promise.resolve(false);
        }
        if (robots.length) {
          //Start cleaning with the First Robot
          robots[0].stopCleaning(function (error, result) {
            robots[0].sendToBase();
          });
          log(robots[0].name + " was stopped and will return to base");
          return Promise.resolve(true);
        }
      });
    });
  }
}

module.exports = BotVacCommunity;
'use strict';

const Homey = require('homey');
const Botvac = require('node-botvac');

class BotVacCommunity extends Homey.App {

  credentials={};

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    // Register Actions
    const startCleaningAction = this.homey.flow.getActionCard('start_cleaning');
    startCleaningAction
      .registerRunListener(async (args, state) => {
        return this.startCleaning(this.log);
      });

    const stopCleaningAction = this.homey.flow.getActionCard('stop_cleaning');
    stopCleaningAction
      .registerRunListener(async (args, state) => {
        return this.stopCleaning(this.log);
      });

    // Get settings
    this.credentials.user = this.homey.settings.get('username');
    this.credentials.pass = this.homey.settings.get('password');

    this.log('BotVacCommunity has been initialized');
  }

  /**
   * Start the cleaning cycle.
   */
  startCleaning(log) {
    log('startCleaning function call');
    const client = new Botvac.Client();
    // eslint-disable-next-line consistent-return
    client.authorize(this.credentials.user, this.credentials.pass, true, error => {
      if (error) {
        log(error);
        return Promise.resolve(false);
      }
      // eslint-disable-next-line no-shadow, consistent-return
      client.getRobots((error, robots) => {
        if (error) {
          log(error);
          return Promise.resolve(false);
        }
        if (robots.length) {
          // Start cleaning with Robot 0 since I haven't implemented robot selection logic yet
          const robot = robots[0];
          // eslint-disable-next-line no-shadow
          robot.getState((error, state) => {
            if (error) {
              log(`${robot.name} got an error`);
              return Promise.resolve(false);
            }

            if (!state || !state.availableCommands) {
              log(`${robot.name} didn't return states`);
              return Promise.resolve(false);
            }

            if (state.availableCommands.start) {
              robot.startCleaning(true, 2, true);
              log(`${robot.name} will start cleaning`);
              return Promise.resolve(true);
            }
            if (state.availableCommands.resume) {
              robot.resumeCleaning();
              log(`${robot.name} will resume cleaning`);
              return Promise.resolve(true);
            }
            log(`${robot.name} cannot start or resume`);
            return Promise.resolve(false);
          });
        } else {
          log('No robots found');
          return Promise.resolve(false);
        }
      });
    });
  }

  /**
   * Stop (pause) the cleaning cycle and send BotVac to dock.
   */
  stopCleaning(log) {
    log('stopCleaning function call');
    const client = new Botvac.Client();
    // eslint-disable-next-line consistent-return
    client.authorize(this.credentials.user, this.credentials.pass, true, error => {
      if (error) {
        log(error);
        return Promise.resolve(false);
      }
      // eslint-disable-next-line no-shadow, consistent-return
      client.getRobots((error, robots) => {
        if (error) {
          log(error);
          return Promise.resolve(false);
        }
        if (robots.length) {
          const robot = robots[0];
          // Pause cleaning with the First Robot
          // Cleaning must be paused before it can be sent to dock
          // eslint-disable-next-line no-shadow
          robot.pauseCleaning((error, result) => {
            if (error) {
              log(`${robot.name} could not pause`);
              return Promise.resolve(false);
            }
            log(`${robot.name} was paused`);

            // eslint-disable-next-line no-shadow
            function sendToDock(robot, retries, log) {
              if (retries > 0) {
                // eslint-disable-next-line no-shadow, consistent-return
                robot.getState((error, state) => {
                  if (error) {
                    return Promise.resolve(false);
                  }
                  if (state && state.availableCommands) {
                    log(state.availableCommands);
                    if (state.availableCommands.goToBase) {
                      robot.sendToBase();
                      log(`${robot.name} will return to base`);
                      return Promise.resolve(true);
                    }

                    // If we cannot send to base, try again
                    retries--;
                    return sendToDock(robot, retries, log);
                  }
                });
              }
              log(`${robot.name} cannot return to base`);
              return Promise.resolve(false);
            }
            // It can take significant time from BotVac Pause until it can be sent to dock.
            // Resolving this with recursive retries for now
            return sendToDock(robot, 50, log);
          });
        }
      });
    });
  }

}

module.exports = BotVacCommunity;

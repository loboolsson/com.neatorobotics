'use strict';

const Homey = require('homey');
const Botvac = require('node-botvac');

class BotVacCommunity extends Homey.App {

  user='';
  pass=''
  botvacClient=new Botvac.Client();

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    // Register Actions
    const startCleaningAction = this.homey.flow.getActionCard('start_cleaning');
    startCleaningAction
      .registerRunListener(async (args, state) => {
        this.log('Register start cleaning');
        const promise = this.startCleaning();
        return promise;
      });

    const stopCleaningAction = this.homey.flow.getActionCard('stop_cleaning');
    stopCleaningAction
      .registerRunListener(async (args, state) => {
        return this.stopCleaning(this.log);
      });

    // Get settings
    this.user = this.homey.settings.get('username');
    this.pass = this.homey.settings.get('password');

    this.log('BotVacCommunity has been initialized');
  }

  /**
   * Authentication
   */
  auth() {
    const self = this;
    self.log('Run auth');
    const authPromise = new Promise((resolve, reject) => {
      self.log('In the promise');
      self.botvacClient.authorize(self.user, self.pass, false, error => {
        if (error) {
          self.log('Auth error', error);
          reject(error);
        } else {
          self.log('Auth success', error);
          resolve(true);
        }
      });
    });
    self.log('return auth');
    return authPromise;
  }

  /**
   * Get robot
   */
  async getRobot() {
    const self = this;

    try {
      await this.auth();
    } catch (error) {
      return Promise.reject(error);
    }

    self.log('Run robots');
    const robotPromise = new Promise((resolve, reject) => {
      self.log('In the robot promise');
      self.botvacClient.getRobots((error, robots) => {
        if (error) {
          self.log('Error getting robots', error);
          reject(error);
        } else if (!robots) {
          self.log('0 robots returned', error);
          reject(error);
        } else {
          const robot = robots[0];
          resolve(robot);
        }
      });
    });
    self.log('return robot');
    return robotPromise;
  }

  /**
   * Start the cleaning cycle.
   */
  async startCleaning() {
    const self = this;
    let robot;

    self.log('startCleaning function call');
    try {
      robot = await this.getRobot();
    } catch (error) {
      return Promise.reject(error);
    }
    const cleaningPromise = new Promise((resolve, reject) => {
      robot.getState((error, state) => {
        if (error) {
          reject(error);
        }
        if (!state || !state.availableCommands) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${robot.name} didn't return states`);
        }
        if (state.availableCommands.start) {
          robot.startCleaning(true, 2, true);
          self.log(`${robot.name} will start cleaning`);
          resolve(true);
        }
        if (state.availableCommands.resume) {
          robot.resumeCleaning();
          self.log(`${robot.name} will resume cleaning`);
          resolve(true);
        }
        // eslint-disable-next-line prefer-promise-reject-errors
        reject(`${robot.name} cannot start or resume`);
      });
    });

    return cleaningPromise;
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
